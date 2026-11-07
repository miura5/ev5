import { deriveWeakSpot, weakSpotFromRows } from "../../domain/index.ts";
import type { TodayDocs } from "./plans.ts";
import { attemptsBySpot } from "./attempts.ts";

/** Each live weak spot as the scheduler's model plus its derived state; `exam` is the soonest open goal it is linked to,
 * directly or through its objective (Library's rule, restated: areas never import each other). */
export function spotsOf(docs: TodayDocs) {
  const linked = new Map<string, string[]>();
  for (const l of docs.links ?? [])
    if (l.to_kind === "goal")
      linked.set(l.from_id, [...(linked.get(l.from_id) ?? []), l.to_id]);
  const openGoals = docs.goals
    .filter((g) => g.status === "open")
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const answered = attemptsBySpot(docs.attempts, docs.items);
  return docs.weakspots
    .filter((r) => r.duplicate_of === null)
    .map((r) => {
      const ends = [r.id, ...(r.objective_id ? [r.objective_id] : [])].flatMap(
        (i) => linked.get(i) ?? [],
      );
      const v = {
        ...weakSpotFromRows(
          r,
          (docs.weakSpotEvents ?? []).filter((e) => e.weak_spot_id === r.id),
        ),
        exam: openGoals.find((g) => ends.includes(g.id))?.id ?? null,
      };
      return {
        id: r.id,
        v,
        d: deriveWeakSpot(v, answered.get(r.id) ?? [], { id: r.id }),
      };
    });
}
