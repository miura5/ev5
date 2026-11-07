// Where the prep plan reads its date and weak spots.
// load: the date (its goal row) plus the weak spots (rows, §data.tables) linked to that goal, derived with their `attempts` rows as of Central today, with
// the active ones worst first (the order is code, CONTRACT §cmd.code-first). An approved plan lands as `plans` and `plan_items`
// rows through d1PlanStore (jobs/runtime), not here.
import {
  centralDate,
  deriveWeakSpot,
  gradedBySpot,
  lastDay,
  isActive,
  parseGoal,
  reviewNeed,
} from "../domain/index.ts";
import { readJobPlan } from "./job-plans.ts";
import { goalDoc } from "./goal-wire.ts";
import { weakSpotDocs } from "./weak-wire.ts";
import { tablesRepo, type DocsD1 } from "../data/index.ts";
import type { Attempt } from "../domain/index.ts";
import type { D1Like } from "../jobs/index.ts";
import type { JobRunEnv } from "./job-run.ts";

/**
 * Every graded answer aimed at a weak spot, read through the gate's `attempts` and `set_items` readers (§data.gate): the
 * attempt's item names the spot. The one rule (correct at score >= 0.5; ungraded rows left out) is domain/answers' gradedBySpot.
 * Oldest answer first, as the scheduler reads them.
 */
async function attemptsBySpot(
  db: D1Like,
  clock: () => number,
): Promise<Map<string, Attempt[]>> {
  const t = tablesRepo(db as DocsD1, { clock });
  const attempts = [...(await t.attempts.list())].sort(
    (x, y) => x.answered_at - y.answered_at || x.id.localeCompare(y.id),
  );
  return gradedBySpot(attempts, await t.setItems.list());
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
      const attempts = await attemptsBySpot(db, clock);
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
