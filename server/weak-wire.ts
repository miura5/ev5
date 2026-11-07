// Weak spots as the screens and the plan read them (CONTRACT §data.tables, §data.gate): the `weak_spots` and
// `weak_spot_events` rows, read through the tables gate, shown as the weak spot document. A spot has no goal of its own:
// it links to a goal directly or through its objective (§data.links), so a spot's goal is the soonest upcoming
// goal it is linked to (a goal with no date comes after the dated ones). No name is matched.
import { tablesRepo } from "../data/index.ts";
import type { Reads } from "./read-report.ts";
import { goalDocs, goalsByObjective, goalsByWeakSpot } from "./goal-wire.ts";
import type { DocsD1 } from "../data/index.ts";
import {
  newWeakSpotRow,
  parseGoal,
  parseWeakSpot,
  weakSpotDoc,
} from "../domain/index.ts";

export interface WireSpot {
  id: string;
  v: number;
  at: number;
  data: ReturnType<typeof weakSpotDoc>;
  /** The date of the spot's goal, for the near-date interval. */
  goalDate: string | null;
}

/** A spot's goal: the soonest upcoming goal it is linked to, directly or through its objective (§data.links), else none. */
function goalOfObjective(
  rows: { id: string; data: unknown }[],
  linked: Map<string, string[]>,
) {
  const upcoming = rows.flatMap((r) => {
    try {
      const e = parseGoal(r.data);
      return (e.status ?? "upcoming") === "upcoming"
        ? [{ id: r.id, goal: e }]
        : [];
    } catch {
      return []; // one malformed goal must not hide the spots
    }
  });
  return (ids: string[]) =>
    upcoming
      .filter((u) => ids.some((i) => (linked.get(i) ?? []).includes(u.id)))
      .sort((a, b) =>
        (a.goal.date ?? "9999").localeCompare(b.goal.date ?? "9999"),
      )[0];
}

/** Every live weak spot (a duplicate counts once, as its twin) as its document, in id order. */
export async function weakSpotDocs(
  db: DocsD1,
  clock: () => number,
  reads?: Reads,
): Promise<WireSpot[]> {
  const t = tablesRepo(db, { clock, onBad: reads?.onBad });
  const [spots, events, exams, linked, direct] = await Promise.all([
    t.weakSpots.list().then((r) => reads?.counted("weak_spots", r) ?? r),
    t.weakSpotEvents
      .list()
      .then((r) => reads?.counted("weak_spot_events", r) ?? r),
    goalDocs(db, clock, reads),
    goalsByObjective(db, clock),
    goalsByWeakSpot(db, clock),
  ]);
  const goalOf = goalOfObjective(exams, new Map([...linked, ...direct]));
  return spots
    .filter((s) => s.duplicate_of === null)
    .map((s) => {
      const own = events.filter((e) => e.weak_spot_id === s.id);
      const goal = goalOf([s.id, ...(s.objective_id ? [s.objective_id] : [])]);
      return {
        id: s.id,
        v: s.v,
        // An event is an appended row and does not touch the spot's row, so the spot changed when its newest event came.
        at: own.reduce((m, e) => Math.max(m, e.at), s.at),
        data: weakSpotDoc(s, own, { exam: goal?.id ?? null }),
        goalDate: goal?.goal.date ?? null,
      };
    });
}
