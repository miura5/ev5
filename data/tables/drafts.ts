// Repositories for E.V.'s set-item drafts and the soft-delete list (CONTRACT data.drafts, delete.soft). Every write takes
// its `at` from the Worker clock and a draft change is pinned to the version read, so a stale write changes nothing.
import { parseDeletion } from "../../domain/index.ts";
import type { D1Like } from "../docs/d1.ts";
import type { TablesOptions } from "./core.ts";
import { gateRow } from "./gate.ts";

export type PendingDraft = { id: string; targetId: string; v: number };

export function draftsRepo(db: D1Like, opts: TablesOptions) {
  const del = (c: string, id: string) =>
    gateRow("deletions", () => parseDeletion({ c, id, at: opts.clock() }));
  const pending = async (
    where: string,
    arg: string,
    kind: string,
  ): Promise<PendingDraft[]> =>
    (
      await db
        .prepare(
          `SELECT id, target_id, v FROM drafts WHERE ${where} AND kind = ? AND state = 'pending' ORDER BY at, id`,
        )
        .bind(arg, kind)
        .all<{ id: string; target_id: string; v: number }>()
    ).results.map((r) => ({ id: r.id, targetId: r.target_id, v: r.v }));
  return {
    drafts: {
      pendingById: (id: string, kind: string) => pending("id = ?", id, kind),
      pendingForSet: (setId: string, kind: string) =>
        pending("target_id = ?", setId, kind),
      /** Pending draft `id` in set `setId`, or null. */
      pendingIn: async (id: string, setId: string, kind: string) =>
        (
          await db
            .prepare(
              "SELECT id FROM drafts WHERE id = ? AND target_id = ? AND kind = ? AND state = 'pending'",
            )
            .bind(id, setId, kind)
            .first<{ id: string }>()
        )?.id ?? null,
      /** Saves a new pending draft at version 1. */
      create: async (d: {
        id: string;
        jobId: string;
        kind: string;
        targetC: string;
        targetId: string;
        body: string;
      }): Promise<void> => {
        await db
          .prepare(
            "INSERT INTO drafts (id, job_id, kind, target_c, target_id, body, state, at, v) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 1)",
          )
          .bind(
            d.id,
            d.jobId,
            d.kind,
            d.targetC,
            d.targetId,
            d.body,
            opts.clock(),
          )
          .run();
      },
      /** Moves a pending draft to `state` with `body`, only if it is still at version `v`; whether it moved. */
      claim: async (
        id: string,
        v: number,
        state: "kept" | "dropped",
        body: string,
      ): Promise<boolean> =>
        (
          await db
            .prepare(
              "UPDATE drafts SET state = ?, body = ?, at = ?, v = v + 1 WHERE id = ? AND v = ? AND state = 'pending'",
            )
            .bind(state, body, opts.clock(), id, v)
            .run()
        ).meta.changes > 0,
      /** Hands a kept draft back to pending, only if it is still at version `v`; whether it moved. */
      reopen: async (id: string, v: number): Promise<boolean> =>
        (
          await db
            .prepare(
              "UPDATE drafts SET state = 'pending', at = ?, v = v + 1 WHERE id = ? AND v = ? AND state = 'kept'",
            )
            .bind(opts.clock(), id, v)
            .run()
        ).meta.changes > 0,
      /** Replaces a pending draft's body, only if it is still at version `v`; whether it changed. */
      edit: async (id: string, v: number, body: string): Promise<boolean> =>
        (
          await db
            .prepare(
              "UPDATE drafts SET body = ?, at = ?, v = v + 1 WHERE id = ? AND v = ? AND state = 'pending'",
            )
            .bind(body, opts.clock(), id, v)
            .run()
        ).meta.changes > 0,
      /**
       * Keeps or drops each draft in ONE batch. A keep copies the draft into its set first. Each statement is pinned to
       * the version read and the pending state, so a draft that changed meanwhile is left alone.
       */
      settle: async (rows: PendingDraft[], keep: boolean): Promise<void> => {
        const at = opts.clock();
        await db.batch(
          rows.flatMap((r) => [
            ...(keep
              ? [
                  db
                    .prepare(
                      "INSERT OR IGNORE INTO own_set_items (set_id, item_id, pos, body, at, v) SELECT target_id, id, " +
                        "(SELECT COALESCE(MAX(pos) + 1, 0) FROM own_set_items WHERE set_id = ?), body, ?, 1 " +
                        "FROM drafts WHERE id = ? AND v = ? AND state = 'pending'",
                    )
                    .bind(r.targetId, at, r.id, r.v),
                ]
              : []),
            db
              .prepare(
                "UPDATE drafts SET state = ?, at = ?, v = v + 1 WHERE id = ? AND v = ? AND state = 'pending'",
              )
              .bind(keep ? "kept" : "dropped", at, r.id, r.v),
          ]),
        );
      },
    },
    deletions: {
      /** Soft delete of a set item by its `<set>/<item>` key; the latest delete time wins and no row is removed. */
      markOwnSetItem: async (setId: string, itemId: string): Promise<void> => {
        const row = del("own_set_items", `${setId}/${itemId}`);
        await db
          .prepare(
            "INSERT INTO deletions (c, id, at) VALUES ('own_set_items', ?, ?) ON CONFLICT (c, id) DO UPDATE SET at = excluded.at",
          )
          .bind(row.id, row.at)
          .run();
      },
      /** Soft delete of a collection; its items are not touched and show ungrouped until it is restored. */
      markCollection: async (id: string): Promise<void> => {
        const row = del("collections", id);
        await db
          .prepare(
            "INSERT INTO deletions (c, id, at) VALUES ('collections', ?, ?) ON CONFLICT (c, id) DO UPDATE SET at = excluded.at",
          )
          .bind(row.id, row.at)
          .run();
      },
      /** Takes one item (collection `c`, id `id`) back out of Recently deleted; the number of rows cleared. */
      restore: async (c: string, id: string): Promise<number> =>
        (
          await db
            .prepare("DELETE FROM deletions WHERE c = ? AND id = ?")
            .bind(c, id)
            .run()
        ).meta.changes,
    },
  };
}
