// Where the prep plan reads its date and weak spots.
// load: the date (its goal row) plus the weak spots (rows, §data.tables) linked to that goal, derived with their `answers` as of Central today, with
// the active ones worst first (the order is code, CONTRACT §cmd.code-first). An approved plan lands as `plans` and `plan_items`
// rows through d1PlanStore (jobs/runtime), not here.
import {
  centralDate,
  deriveWeakSpot,
  lastDay,
  isActive,
  parseGoal,
  reviewNeed,
} from "../domain/index.ts";
import { readJobPlan } from "./job-plans.ts";
import { goalDoc } from "./goal-wire.ts";
import { weakSpotDocs } from "./weak-wire.ts";
import type { DocsD1 } from "../data/index.ts";
import type { Attempt } from "../domain/index.ts";
import type { D1Like } from "../jobs/index.ts";
import type { JobRunEnv } from "./job-run.ts";

type Row = { id: string; data: string; v: number };
type Answers = Record<string, Record<string, Record<string, unknown>>>;

const SPOT_FIELD = "weakspotId";

/** Every answer aimed at a weak spot, from the page's append-only `answers` documents. */
async function attemptsBySpot(db: D1Like): Promise<Map<string, Attempt[]>> {
  const { results } = await db
    .prepare("SELECT data FROM docs WHERE c = 'answers' AND data LIKE ?")
    .bind(`%"${SPOT_FIELD}"%`)
    .all<{ data: string }>();
  const out = new Map<string, Attempt[]>();
  for (const r of results) {
    const answers = (JSON.parse(r.data) as { answers?: Answers }).answers ?? {};
    for (const byKey of Object.values(answers))
      for (const a of Object.values(byKey)) {
        const id = a[SPOT_FIELD];
        if (
          typeof id !== "string" ||
          typeof a.correct !== "boolean" ||
          typeof a.at !== "string"
        )
          continue;
        const at: Attempt = {
          at: a.at,
          correct: a.correct,
          ...(a.matched ? { matched: true } : {}),
        };
        out.set(id, [...(out.get(id) ?? []), at]);
      }
  }
  return out;
}

/** The last day of a job's saved draft plan (Central date), or undefined when it has no draft or no tasks. */
export async function lastDraftDay(
  db: D1Like,
  jobId: string,
): Promise<string | undefined> {
  const body = await readJobPlan(db, jobId, "draft");
  if (body === undefined) return undefined;
  const tasks = (body as { tasks?: { date?: unknown }[] }).tasks;
  return lastDay(
    (tasks ?? []).flatMap((t) => (typeof t.date === "string" ? [t.date] : [])),
  );
}

export function planHome(
  db: D1Like,
  clock: () => number,
): JobRunEnv["planHome"] {
  return {
    async load(goalId) {
      const row = await goalDoc(db as DocsD1, clock, goalId);
      if (!row) return undefined;
      const exam = parseGoal(row.data);
      const today = centralDate(clock());
      // The weak spots are rows (§data.tables); the ones whose objective is linked to this goal are aimed at it.
      const attempts = await attemptsBySpot(db);
      const spots = (await weakSpotDocs(db as DocsD1, clock)).flatMap((r) => {
        const spot = r.data;
        if (spot.exam !== goalId) return [];
        const model = {
          kind: spot.kind,
          derived: deriveWeakSpot(spot, attempts.get(r.id) ?? [], {
            goalDate: exam.date ?? null,
            id: r.id,
          }),
        };
        return isActive(model)
          ? [{ id: r.id, title: spot.topic, need: reviewNeed(model) }]
          : [];
      });
      return { exam: { ...exam, id: goalId }, spots, today };
    },
  };
}
