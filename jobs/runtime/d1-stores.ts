// D1-backed stores for the job runtime: JobStore, CeilingStore, PlanStore and the save step.
// Tables are in data/migrations/0002_jobs_ceilings.sql (jobs and ceilings are not ev4 `docs` collections: ceilings
// need arithmetic in one statement, and ev4 already owns the `jobs` and `jobresults` collections).
// All writes follow the docs protocol: `at` from the injected Worker clock, `v` bumped, canonical JSON, batches atomic.
// The slice of Cloudflare's D1 API used here (the real binding satisfies it structurally; data/ has no index to import).
export interface D1Statement {
  bind(...values: (string | number | null)[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}
import type { CeilingStore, Limit, StoreResult, Window } from "./ceilings.ts";
import type { JobRecord, JobStore } from "./record.ts";
import type { Plan, PlanContext, PlanStore } from "../study-plan/job.ts";
import type { DraftRow, PracticeItem } from "../practice-set/job.ts";

type Clock = () => number;

export function d1JobStore(db: D1Like, clock: Clock): JobStore {
  const parse = (r: { data: string }) => JSON.parse(r.data) as JobRecord;
  return {
    async get(id) {
      const r = await db
        .prepare("SELECT data FROM job_records WHERE id = ?")
        .bind(id)
        .first<{ data: string }>();
      return r ? parse(r) : undefined;
    },
    async list() {
      const { results } = await db
        .prepare("SELECT data FROM job_records ORDER BY at, id")
        .all<{ data: string }>();
      return results.map(parse);
    },
    async put(rec) {
      const data = JSON.stringify(rec);
      if (rec.v === 1) {
        try {
          await db
            .prepare(
              "INSERT INTO job_records (id, data, at, v) VALUES (?, ?, ?, 1)",
            )
            .bind(rec.id, data, clock())
            .run();
          return true;
        } catch {
          return false; // the id exists: a stale create
        }
      }
      const r = await db
        .prepare(
          "UPDATE job_records SET data = ?, at = ?, v = ? WHERE id = ? AND v = ?",
        )
        .bind(data, clock(), rec.v, rec.id, rec.v - 1)
        .run();
      return r.meta.changes === 1;
    },
  };
}

const STALE = "SELECT CASE WHEN changes() = 0 THEN json('refused') END";

export function d1CeilingStore(db: D1Like): CeilingStore {
  const used = async (w: Window, k: string) =>
    (
      await db
        .prepare("SELECT used FROM ceiling_use WHERE w = ? AND k = ?")
        .bind(w, k)
        .first<{ used: number }>()
    )?.used ?? 0;
  const hold = (id: string) =>
    db
      .prepare("SELECT amount, limits, open FROM ceiling_holds WHERE id = ?")
      .bind(id)
      .first<{
        amount: number;
        limits: string;
        open: number;
      }>();
  /** Adds `n` (may be negative) to every window; with `cap`, each add happens only if it stays within its limit. */
  const adds = (
    limits: { window: Window; key: string; limit?: number }[],
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
    // One batch: every window's guarded add, then the hold row. A guard that finds no room throws, so D1 rolls back
    // the whole batch; two jobs reserving at once are serialized by D1, so the second sees the first's spend.
    async reserve({ id, amount, limits }) {
      if (await hold(id)) throw new Error(`reservation ${id} already exists`);
      const hold1 = db
        .prepare(
          "INSERT INTO ceiling_holds (id, amount, limits) VALUES (?, ?, ?)",
        )
        .bind(id, amount, JSON.stringify(limits));
      try {
        await db.batch([...adds(limits, amount), hold1]);
        return { ok: true };
      } catch (e) {
        for (const l of limits) {
          const u = await used(l.window, l.key);
          if (u + amount > l.limit)
            return {
              ok: false,
              window: l.window,
              used: u,
              limit: l.limit,
            } as StoreResult;
        }
        throw e;
      }
    },
    async settle(id, actual) {
      const h = await hold(id);
      if (!h || !h.open) throw new Error(`no reservation ${id}`);
      const guard = db
        .prepare(
          "UPDATE ceiling_holds SET amount = ? WHERE id = ? AND open = 1 AND amount = ?",
        )
        .bind(actual, id, h.amount);
      await db.batch(
        [
          guard,
          db.prepare(STALE),
          ...adds(JSON.parse(h.limits) as Limit[], actual - h.amount),
        ].map((s) => s),
      );
    },
    async release(id) {
      const h = await hold(id);
      if (!h || !h.open) return;
      const guard = db
        .prepare("UPDATE ceiling_holds SET open = 0 WHERE id = ? AND open = 1")
        .bind(id);
      await db.batch([
        guard,
        db.prepare(STALE),
        ...adds(JSON.parse(h.limits) as Limit[], -h.amount),
      ]);
    },
    used,
  };
}

const json = (v: unknown) => JSON.stringify(v);

/** The study plan's content in `job_plans`, keyed by job id so a retried step writes the same row. */
export function d1PlanStore(
  db: D1Like,
  clock: Clock,
  home: {
    /** Reads the exam and weak spots (ev4 docs, Central date) and puts an approved plan's tasks on Today. */
    load: PlanStore["load"];
    apply: (jobId: string, plan: Plan) => Promise<string>;
  },
): PlanStore {
  const put = async (jobId: string, kind: string, body: unknown) => {
    await db
      .prepare(
        "INSERT INTO job_plans (job_id, kind, body, at) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (job_id, kind) DO UPDATE SET body = excluded.body, at = excluded.at",
      )
      .bind(jobId, kind, json(body), clock())
      .run();
    return `${jobId}:${kind}`;
  };
  const get = async <T>(
    jobId: string,
    kind: string,
  ): Promise<T | undefined> => {
    const r = await db
      .prepare("SELECT body FROM job_plans WHERE job_id = ? AND kind = ?")
      .bind(jobId, kind)
      .first<{ body: string }>();
    return r ? (JSON.parse(r.body) as T) : undefined;
  };
  const need = async <T>(jobId: string, kind: string) => {
    const v = await get<T>(jobId, kind);
    if (v === undefined) throw new Error(`job ${jobId}: no ${kind} saved`);
    return v;
  };
  return {
    load: home.load,
    putContext: (j, ctx: PlanContext) => put(j, "context", ctx),
    getContext: (j) => need<PlanContext>(j, "context"),
    putDraft: (j, plan) => put(j, "draft", plan),
    getDraft: (j) => need<Plan>(j, "draft"),
    putFailure: async (j, reason) => void (await put(j, "failure", reason)),
    getFailure: (j) => get<string>(j, "failure"),
    async approve(jobId, plan) {
      const id = await home.apply(jobId, plan);
      await put(jobId, "status", "approved");
      return id;
    },
    async putAway(jobId) {
      return put(jobId, "status", "put away"); // the draft row stays
    },
  };
}

/**
 * The save step: sourced items become set items and unsourced (or "Write with E.V.") items become pending drafts,
 * in ONE batch, so nothing half-lands. Ids are `<jobId>:<n>` and inserts ignore a repeat, so a retried step is safe.
 */
export async function saveOutput(
  db: D1Like,
  clock: Clock,
  a: {
    jobId: string;
    targetId: string;
    items: PracticeItem[];
    drafts: DraftRow[];
  },
): Promise<{ itemIds: string[]; draftIds: string[] }> {
  const at = clock();
  const itemIds = a.items.map((_, n) => `${a.jobId}:i${n}`);
  const draftIds = a.drafts.map((_, n) => `${a.jobId}:d${n}`);
  await db.batch([
    ...a.items.map((q, n) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO own_set_items (set_id, item_id, pos, body, at, v) VALUES (?, ?, ?, ?, ?, 1)",
        )
        .bind(a.targetId, itemIds[n]!, n, json(q), at),
    ),
    ...a.drafts.map((d, n) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO drafts (id, job_id, kind, target_c, target_id, body, state, at, v) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 1)",
        )
        .bind(
          draftIds[n]!,
          d.jobId,
          d.kind,
          d.targetC,
          d.targetId,
          json(d.body),
          at,
        ),
    ),
  ]);
  return { itemIds, draftIds };
}
