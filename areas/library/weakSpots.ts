import { deriveWeakSpot, weakSpotFromRows } from "../../domain/index.ts";
import type {
  GoalRow,
  LinkRow,
  WeakSpotEventRow,
  WeakSpotTableRow,
} from "../../domain/index.ts";

/** The rows Library reads weak spots from: GET /weak-spots, /weak-spot-events, /links and /goals (§data.gate). */
export interface SpotRows {
  goals: GoalRow[];
  weakspots: WeakSpotTableRow[];
  weakSpotEvents?: WeakSpotEventRow[];
  links?: LinkRow[];
}

/** Each live weak spot as the scheduler's model plus its derived state; its date is the model's `exam`. */
export function spotsOf(docs: SpotRows) {
  const linked = new Map<string, string[]>();
  for (const l of docs.links ?? [])
    if (l.to_kind === "goal")
      linked.set(l.from_id, [...(linked.get(l.from_id) ?? []), l.to_id]);
  // A spot's date is the soonest open goal it is linked to, directly or through its objective; a goal with no date comes last.
  const openGoals = docs.goals
    .filter((g) => g.status === "open")
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const goalOf = (s: WeakSpotTableRow): string | undefined => {
    const ends = [s.id, ...(s.objective_id ? [s.objective_id] : [])].flatMap(
      (i) => linked.get(i) ?? [],
    );
    return openGoals.find((g) => ends.includes(g.id))?.id;
  };
  const spots = docs.weakspots
    .filter((r) => r.duplicate_of === null)
    .map((r) => {
      const v = weakSpotFromRows(
        r,
        (docs.weakSpotEvents ?? []).filter((e) => e.weak_spot_id === r.id),
      );
      return {
        id: r.id,
        v: { ...v, exam: goalOf(r) ?? null },
        d: deriveWeakSpot(v, [], { id: r.id }),
      };
    });
  return spots;
}
