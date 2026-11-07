import type { AttemptRow } from "../../domain/index.ts";

/** One answer in the shape domain/answers tallies (and series.ts reads): an attempts row, restated. */
export interface AnswerLike {
  id: string;
  data: { setId: string; answers: Record<string, Record<string, unknown>> };
}

/**
 * The attempts rows (GET /attempts) as answers: one entry per attempt. A score of 0.5 or more is right; a told,
 * skipped or unread answer carries no verdict, and a self-rating carries its rating (never a score).
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
