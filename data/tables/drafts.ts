// Repositories for E.V.'s set-item drafts and the soft-delete list (CONTRACT data.drafts, delete.soft). Every write takes
// its `at` from the Worker clock and a draft change is pinned to the version read, so a stale write changes nothing.
import {
  draftKey,
  itemKey,
  parseDeletion,
  parseDraftTableRow,
  setKey,
} from "../../domain/index.ts";
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
      pendingById: (id: string, kind: string) =>
        pending("id = ?", draftKey(id), kind),
      pendingForSet: (setId: string, kind: string) =>
        pending("target_id = ?", setId, kind),
      /** Pending draft `id` in set `setId`, or null. */
      pendingIn: async (id: string, setId: string, kind: string) =>
        (
          await db
            .prepare(
              "SELECT id FROM drafts WHERE id = ? AND target_id = ? AND kind = ? AND state = 'pending'",
            )
            .bind(draftKey(id), setId, kind)
            .first<{ id: string }>()
        )?.id ?? null,
      /** Saves a new pending draft at version 1. `id` may be bare; the row's id carries `draft_`. */
      create: async (d: {
        id: string;
        job_id: string;
        kind: string;
        target_kind: string;
        target_id: string;
        body: Record<string, unknown>;
      }): Promise<void> => {
        const row = gateRow("drafts", () =>
          parseDraftTableRow({
            ...d,
            id: draftKey(d.id),
            state: "pending",
            at: opts.clock(),
            v: 1,
          }),
        );
        await db
          .prepare(
            "INSERT INTO drafts (id, job_id, kind, target_c, target_kind, target_id, body, state, at, v) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 1)",
          )
          .bind(
            row.id,
            row.job_id,
            row.kind,
            row.target_kind,
            row.target_kind,
            row.target_id,
            JSON.stringify(row.body),
            row.at,
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
                      "INSERT OR IGNORE INTO set_items (id, set_id, pos, type, body, at, v) SELECT 'item_' || substr(id, 7), ?, " +
                        "(SELECT COALESCE(MAX(pos) + 1, 0) FROM set_items WHERE set_id = ?), " +
                        "COALESCE(json_extract(body, '$.type'), 'single'), json_remove(body, '$.id'), ?, 1 " +
                        "FROM drafts WHERE id = ? AND v = ? AND state = 'pending'",
                    )
                    .bind(
                      setKey(r.targetId),
                      setKey(r.targetId),
                      at,
                      r.id,
                      r.v,
                    ),
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
      /** Soft delete of a set item, listed as `set_items` by its item id (`setId` is kept for callers); the latest delete time wins and no row is removed. */
      markOwnSetItem: async (_setId: string, itemId: string): Promise<void> => {
        const row = del("set_items", itemKey(itemId));
        await db
          .prepare(
            "INSERT INTO deletions (c, id, at) VALUES ('set_items', ?, ?) ON CONFLICT (c, id) DO UPDATE SET at = excluded.at",
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
      /** Soft delete of a note by its document id: a deletions row, and the row's `deleted_at` (reads hide it, §delete.soft). */
      markNote: async (docId: string): Promise<boolean> => {
        const row = del("notes", docId);
        const r = await db
          .prepare(
            "UPDATE notes SET deleted_at = ?, v = v + 1, at = ? WHERE id = ? AND deleted_at IS NULL",
          )
          .bind(row.at, row.at, `note_${docId}`)
          .run();
        if (r.meta.changes === 0) return false;
        await db
          .prepare(
            "INSERT INTO deletions (c, id, at) VALUES ('notes', ?, ?) ON CONFLICT (c, id) DO UPDATE SET at = excluded.at",
          )
          .bind(row.id, row.at)
          .run();
        return true;
      },
      /** Clears every Recently deleted row of a set item: its item-id row and the older `<set>/<item>` rows. */
      restoreSetItem: async (itemId: string): Promise<number> => {
        const key = itemKey(itemId);
        const bare = key.slice("item_".length);
        const r = await db
          .prepare(
            "DELETE FROM deletions WHERE (c = 'set_items' AND id IN (?, ?)) OR (c = 'own_set_items' AND (id LIKE ? OR id LIKE ?))",
          )
          .bind(key, bare, `%/${key}`, `%/${bare}`)
          .run();
        return r.meta.changes;
      },
      /** Takes one item (collection `c`, id `id`) back out of Recently deleted; the number of rows cleared. */
      restore: async (c: string, id: string): Promise<number> => {
        const n = (
          await db
            .prepare("DELETE FROM deletions WHERE c = ? AND id = ?")
            .bind(c, id)
            .run()
        ).meta.changes;
        // A set item's deletion is also its row's `deleted_at`: the item comes back with it.
        // `set_items` is keyed by the item id; `own_set_items` is the older `<set>/<item>` key, still cleared the same way.
        if (c === "set_items" || c === "own_set_items")
          await db
            .prepare(
              "UPDATE set_items SET deleted_at = NULL, v = v + 1, at = ? WHERE id = ? AND deleted_at IS NOT NULL",
            )
            .bind(opts.clock(), itemKey(id.slice(id.indexOf("/") + 1)))
            .run();
        if (c === "notes")
          await db
            .prepare(
              "UPDATE notes SET deleted_at = NULL, v = v + 1, at = ? WHERE id = ? AND deleted_at IS NOT NULL",
            )
            .bind(opts.clock(), `note_${id}`)
            .run();
        return n;
      },
    },
  };
}
