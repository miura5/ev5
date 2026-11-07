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
  goalFromRow,
  reviewNeed,
  weakSpotDoc,
} from "../domain/index.ts";
import { readJobPlan } from "./job-plans.ts";
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

export interface SpotWithGoal {
  id: string;
  data: ReturnType<typeof weakSpotDoc>;
  /** The date of the spot's goal, for the near-date interval. */
  goalDate: string | null;
}

/**
 * Every live weak spot (a duplicate counts once, as its twin) as its document, in id order. A spot has no goal of its own:
 * it links to a goal directly or through its objective (§data.links), so its goal is the soonest upcoming goal it is
 * linked to (a goal with no date comes after the dated ones). No name is matched.
 */
export async function weakSpotsWithGoal(
  db: D1Like,
  clock: () => number,
): Promise<SpotWithGoal[]> {
  const t = tablesRepo(db as DocsD1, { clock });
  const [spots, events, goals, links] = await Promise.all([
    t.weakSpots.list(),
    t.weakSpotEvents.list(),
    t.goals.list(),
    t.links.list(),
  ]);
  const upcoming = goals.filter((g) => g.status !== "done" && goalFromRow(g));
  const linked = new Map<string, string[]>();
  for (const l of links)
    if (
      l.to_kind === "goal" &&
      (l.from_kind === "objective" || l.from_kind === "weak_spot")
    )
      linked.set(l.from_id, [...(linked.get(l.from_id) ?? []), l.to_id]);
  return spots
    .filter((s) => s.duplicate_of === null)
    .map((s) => {
      const ids = [s.id, ...(s.objective_id ? [s.objective_id] : [])];
      const goal = upcoming
        .filter((g) => ids.some((i) => (linked.get(i) ?? []).includes(g.id)))
        .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))[0];
      const own = events.filter((e) => e.weak_spot_id === s.id);
      return {
        id: s.id,
        data: weakSpotDoc(s, own, { exam: goal?.id ?? null }),
        goalDate: goal?.date ?? null,
      };
    });
}

export function planHome(
  db: D1Like,
  clock: () => number,
): JobRunEnv["planHome"] {
  return {
    async load(goalId) {
      const row = await tablesRepo(db as DocsD1, { clock }).goals.get(goalId);
      const exam = row && goalFromRow(row);
      if (!exam) return undefined;
      const today = centralDate(clock());
      // The weak spots are rows (§data.tables); the ones whose objective is linked to this goal are aimed at it.
      const attempts = await attemptsBySpot(db, clock);
      const spots = (await weakSpotsWithGoal(db, clock)).flatMap((r) => {
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
