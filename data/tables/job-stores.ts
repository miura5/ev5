// Repositories for the job runtime (§data.gate): job records, the spend ceilings and the save step. The SQL is the job
// runtime's own, moved here unchanged so jobs/ can swap to these. Writes take `at` from the Worker clock, a job record is
// pinned to the version read, and the ceiling statements run as atomic batches that a guard can roll back.
import {
  draftKey,
  itemKey,
  parseDraftTableRow,
  setKey,
  parseCeilingHold,
  parseJobRecord,
  type JobRecordRow,
} from "../../domain/index.ts";
import type { D1Like, D1Statement } from "../d1.ts";
import {
  insertConflict,
  readRows,
  type Listed,
  type Raw,
  type TablesOptions,
} from "./core.ts";
import { gateRow } from "./gate.ts";
import { jobListQuery, type JobListOptions } from "./job-list.ts";

export type CeilingWindow = "hour" | "day" | "month" | "job";
export type CeilingLimit = {
  window: CeilingWindow;
  key: string;
  limit: number;
};
export type CeilingReserve =
  | { ok: true }
  | { ok: false; window: CeilingWindow; used: number; limit: number };
export type SaveDraft = {
  job_id: string;
  kind: string;
  target_kind: string;
  target_id: string;
  body: Record<string, unknown>;
};

// After a guarded UPDATE: a statement that fails (so the whole batch rolls back) when that UPDATE changed nothing.
const STALE = "SELECT CASE WHEN changes() = 0 THEN json('refused') END";

export function jobStoresRepo(db: D1Like, opts: TablesOptions) {
  const parseRec = (r: Raw): JobRecordRow =>
    parseJobRecord(JSON.parse(String(r.data)));

  const used = async (w: CeilingWindow, k: string): Promise<number> =>
    (
      await db
        .prepare("SELECT used FROM ceiling_use WHERE w = ? AND k = ?")
        .bind(w, k)
        .first<{ used: number }>()
    )?.used ?? 0;
  const hold = async (id: string) => {
    const r = await db
      .prepare("SELECT amount, limits, open FROM ceiling_holds WHERE id = ?")
      .bind(id)
      .first<{ amount: number; limits: string; open: number }>();
    if (!r) return null;
    return parseCeilingHold({
      id,
      amount: r.amount,
      limits: JSON.parse(r.limits) as unknown,
      open: r.open === 1,
    });
  };
  /** Adds `n` (may be negative) to every window; a window with a limit adds only if it stays within it. */
  const adds = (
    limits: { window: CeilingWindow; key: string; limit?: number }[],
    n: number,
  ): D1Statement[] =>
    limits.flatMap((l) => {
      const ensure = db
        .prepare(
          "INSERT OR IGNORE INTO ceiling_use (w, k, used) VALUES (?, ?, 0)",
        )
        .bind(l.window, l.key);
      if (l.limit === undefined)
        return [
          ensure,
          db
            .prepare(
              "UPDATE ceiling_use SET used = used + ? WHERE w = ? AND k = ?",
            )
            .bind(n, l.window, l.key),
        ];
      return [
        ensure,
        db
          .prepare(
            "UPDATE ceiling_use SET used = used + ? WHERE w = ? AND k = ? AND used + ? <= ?",
          )
          .bind(n, l.window, l.key, n, l.limit),
        db.prepare(STALE),
      ];
    });

  return {
    jobRecords: {
      get: async (id: string): Promise<JobRecordRow | undefined> => {
        const r = await db
          .prepare("SELECT data FROM job_records WHERE id = ?")
          .bind(id)
          .first<{ data: string }>();
        if (!r) return undefined;
        return readRows("job_records", [{ id, ...r }], parseRec, opts)[0];
      },
      /** Every readable record, oldest write first; the options narrow it in the query (job-list.ts). */
      list: async (o: JobListOptions = {}): Promise<Listed<JobRecordRow>> => {
        const { sql, binds } = jobListQuery(o);
        const { results } = await db
          .prepare(sql)
          .bind(...binds)
          .all<{ id: string; data: string }>();
        return readRows("job_records", results, parseRec, opts);
      },
      /** v 1 creates (false if the id exists); a later v updates only if the stored version is v - 1. */
      put: async (rec: JobRecordRow): Promise<boolean> => {
        const row = gateRow("job_records", () => parseJobRecord(rec));
        const data = JSON.stringify(row);
        if (row.v === 1) {
          try {
            await db
              .prepare(
                "INSERT INTO job_records (id, data, at, v) VALUES (?, ?, ?, 1)",
              )
              .bind(row.id, data, opts.clock())
              .run();
            return true;
          } catch (e) {
            insertConflict("job_records", e);
            return false; // the id exists: a stale create
          }
        }
        const r = await db
          .prepare(
            "UPDATE job_records SET data = ?, at = ?, v = ? WHERE id = ? AND v = ?",
          )
          .bind(data, opts.clock(), row.v, row.id, row.v - 1)
          .run();
        return r.meta.changes === 1;
      },
    },
    ceilings: {
      used,
      hold,
      findOpen: async (prefix: string): Promise<string | undefined> =>
        (
          await db
            .prepare(
              "SELECT id FROM ceiling_holds WHERE open = 1 AND substr(id, 1, ?) = ? ORDER BY id LIMIT 1",
            )
            .bind(prefix.length, prefix)
            .first<{ id: string }>()
        )?.id,
      usageSeen: async (key: string): Promise<boolean> =>
        !!(await db
          .prepare("SELECT 1 AS x FROM ceiling_usage WHERE key = ?")
          .bind(key)
          .first()),
      /**
       * One batch: every window's guarded add, then the hold row. A guard that finds no room fails the batch, so D1 rolls
       * it all back; the refusal then names the first window without room.
       */
      reserve: async (req: {
        id: string;
        amount: number;
        limits: CeilingLimit[];
      }): Promise<CeilingReserve> => {
        const { id, amount, limits } = req;
        if (await hold(id)) throw new Error(`reservation ${id} already exists`);
        const row = db
          .prepare(
            "INSERT INTO ceiling_holds (id, amount, limits) VALUES (?, ?, ?)",
          )
          .bind(id, amount, JSON.stringify(limits));
        try {
          await db.batch([...adds(limits, amount), row]);
          return { ok: true };
        } catch (e) {
          for (const l of limits) {
            const u = await used(l.window, l.key);
            if (u + amount > l.limit)
              return { ok: false, window: l.window, used: u, limit: l.limit };
          }
          throw e;
        }
      },
      /** One batch: the hold closes at the billed amount, the usage key is recorded once, every window moves to it. */
      settle: async (
        id: string,
        actual: number,
        usageKey?: string,
      ): Promise<void> => {
        const h = await hold(id);
        if (!h || !h.open) throw new Error(`no reservation ${id}`);
        await db.batch([
          db
            .prepare(
              "UPDATE ceiling_holds SET amount = ?, open = 0 WHERE id = ? AND open = 1 AND amount = ?",
            )
            .bind(actual, id, h.amount),
          db.prepare(STALE),
          ...(usageKey === undefined
            ? []
            : [
                db
                  .prepare(
                    "INSERT INTO ceiling_usage (key, hold_id) VALUES (?, ?)",
                  )
                  .bind(usageKey, id),
              ]),
          ...adds(h.limits, actual - h.amount),
        ]);
      },
      /** Closes an open hold and gives its amount back to every window, in one batch; no-op when not open. */
      release: async (id: string): Promise<void> => {
        const h = await hold(id);
        if (!h || !h.open) return;
        await db.batch([
          db
            .prepare(
              "UPDATE ceiling_holds SET open = 0 WHERE id = ? AND open = 1",
            )
            .bind(id),
          db.prepare(STALE),
          ...adds(h.limits, -h.amount),
        ]);
      },
    },
    jobOutput: {
      /**
       * Sourced items become set items and the rest pending drafts, in ONE batch. Ids are `<jobId>:i<n>` and
       * `<jobId>:d<n>`; inserts ignore a repeat, so a retried step is safe.
       */
      save: async (a: {
        jobId: string;
        targetId: string;
        items: unknown[];
        drafts: SaveDraft[];
      }): Promise<{ itemIds: string[]; draftIds: string[] }> => {
        const at = opts.clock();
        const itemIds = a.items.map((_, n) => `${a.jobId}:i${n}`);
        const draftIds = a.drafts.map((_, n) => `${a.jobId}:d${n}`);
        const items = a.items.map((q) =>
          JSON.stringify(gateRow("own_set_items", () => q)),
        );
        const drafts = a.drafts.map((d, n) =>
          gateRow("drafts", () =>
            parseDraftTableRow({
              ...d,
              id: draftKey(draftIds[n]!),
              state: "pending",
              at,
              v: 1,
            }),
          ),
        );
        await db.batch([
          ...items.map((body, n) =>
            db
              .prepare(
                "INSERT OR IGNORE INTO set_items (id, set_id, pos, type, body, at, v) VALUES (?, ?, ?, ?, json_remove(?, '$.id'), ?, 1)",
              )
              .bind(
                itemKey(itemIds[n]!),
                setKey(a.targetId),
                n,
                String(
                  (a.items[n] as { type?: unknown } | undefined)?.type ??
                    "single",
                ),
                body,
                at,
              ),
          ),
          ...a.drafts.map((d, n) =>
            db
              .prepare(
                "INSERT OR IGNORE INTO drafts (id, job_id, kind, target_c, target_kind, target_id, body, state, at, v) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 1)",
              )
              .bind(
                drafts[n]!.id,
                d.job_id,
                d.kind,
                d.target_kind,
                d.target_kind,
                d.target_id,
                JSON.stringify(drafts[n]!.body),
                at,
              ),
          ),
        ]);
        return { itemIds, draftIds };
      },
    },
  };
}
