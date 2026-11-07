// domain/answers: the one adapter from `attempts` rows (GET /attempts) to what the tally and the scheduler read.
import type { AttemptRow } from "../attempt/index.ts";
import type { Attempt } from "../weak-spot/index.ts";

/** One answer in the shape `dueCounts`, `accuracyLine` and the progress series read: an attempts row, restated. */
export interface AnswerLike {
  id: string;
  data: {
    schema: 2;
    setId: string;
    answers: Record<string, Record<string, unknown>>;
  };
}

/**
 * The attempts rows as answers: one entry per attempt. A score of 0.5 or more is right; a told, skipped or unread
 * answer carries no verdict, and a self-rating carries its rating (never a score).
 */
export function answersOf(attempts: readonly AttemptRow[]): AnswerLike[] {
  return attempts.map((a) => {
    const rating = (a.answer as { rating?: unknown } | null)?.rating;
    const verdict =
      a.how === "self" && (rating === "again" || rating === "good")
        ? { rating }
        : a.score === null
          ? {}
          : { correct: a.score >= 0.5 };
    return {
      id: a.id,
      data: {
        schema: 2,
        setId: a.set_id,
        answers: {
          [a.item_id]: {
            [a.id]: { at: new Date(a.answered_at).toISOString(), ...verdict },
          },
        },
      },
    };
  });
}

/** Graded answers (a score) as the scheduler's attempts, by weak spot; ungraded ones are left out. */
export function gradedBySpot(
  attempts: readonly AttemptRow[] = [],
  items: readonly { id: string; weak_spot_id: string | null }[] = [],
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
