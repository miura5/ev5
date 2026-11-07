import type { Attempt, AttemptRow, SetItemRow } from "../../domain/index.ts";

/** Graded answers (a score) as the scheduler's attempts, by weak spot; ungraded ones are left out. Library's rule, restated: areas never import each other. */
export function attemptsBySpot(
  attempts: readonly AttemptRow[] = [],
  items: readonly SetItemRow[] = [],
): Map<string, Attempt[]> {
  const spotOf = new Map(items.map((i) => [i.id, i.weak_spot_id]));
  const out = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const spot = spotOf.get(a.item_id);
    if (!spot || a.score === null) continue;
    out.set(spot, [
      ...(out.get(spot) ?? []),
      { at: new Date(a.answered_at).toISOString(), correct: a.score >= 0.5 },
    ]);
  }
  return out;
}
