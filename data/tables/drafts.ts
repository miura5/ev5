// Repositories for E.V.'s set-item drafts and soft delete (CONTRACT data.drafts, delete.soft): `deleted_at` is the one delete mechanism. Every write takes
// its `at` from the Worker clock and a draft change is pinned to the version read, so a stale write changes nothing.
import { draftKey, parseDraftTableRow, setKey } from "../../domain/index.ts";
import type { D1Like } from "../d1.ts";
import type { TablesOptions } from "./core.ts";
import { gateRow } from "./gate.ts";

export type PendingDraft = { id: string; targetId: string; v: number };

export function draftsRepo(db: D1Like, opts: TablesOptions) {
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
  /** Sets `deleted_at` on a live row of `table` in ONE statement (§delete.soft); false when it is missing or already deleted. */
  const softDelete = async (
    table: "sets" | "goals" | "sessions" | "notes",
    rowId: string,
  ): Promise<boolean> => {
    const at = opts.clock();
    const r = await db
      .prepare(
        `UPDATE ${table} SET deleted_at = ?, v = v + 1, at = ? WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(at, at, rowId)
      .run();
    return r.meta.changes > 0;
  };
  return {
    drafts: {
      pendingById: (id: string, kind: string) =>
        pending("id = ?", draftKey(id), kind),
      pendingForSet: (setId: string, kind: string) =>
        pending("target_id = ?", setId, kind),
      /** The pending draft of `kind` with `id` (body and version), or null; never a draft of another kind. */
      pendingRow: async (
        id: string,
        kind: string,
      ): Promise<{
        id: string;
        target_id: string;
        body: string;
        v: number;
      } | null> =>
        await db
          .prepare(
            "SELECT id, target_id, body, v FROM drafts WHERE id = ? AND kind = ? AND state = 'pending'",
          )
          .bind(draftKey(id), kind)
          .first<{ id: string; target_id: string; body: string; v: number }>(),
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
      /** Soft delete of a note by its id (`deleted_at` on its row, reads hide it, §delete.soft). */
      markNote: (docId: string): Promise<boolean> =>
        softDelete("notes", docId),
      /** Soft delete of a set by its id (`set_…`). False when it is missing or already deleted. */
      markSet: (id: string): Promise<boolean> => softDelete("sets", id),
      /** Soft delete of a goal by its id (`goal_…`). */
      markGoal: (id: string): Promise<boolean> => softDelete("goals", id),
      /** Soft delete of a session by its id (`ses_…`). */
      markSession: (id: string): Promise<boolean> => softDelete("sessions", id),
      /** Clears `deleted_at` on a deleted note, set, goal or session of collection `c`; the number of rows restored. */
      restore: async (c: string, id: string): Promise<number> => {
        const table =
          c === "notes" || c === "sets" || c === "goals" || c === "sessions"
            ? c
            : null;
        if (!table) return 0;
        const r = await db
          .prepare(
            `UPDATE ${table} SET deleted_at = NULL, v = v + 1, at = ? WHERE id = ? AND deleted_at IS NOT NULL`,
          )
          .bind(opts.clock(), id)
          .run();
        return r.meta.changes;
      },
    },
  };
}
