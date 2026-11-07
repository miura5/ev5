import type { AttemptRow } from "../../domain/index.ts";

/**
 * The attempts rows (GET /attempts) in the shape domain/answers tallies: one entry per attempt. A score of 0.5 or more
 * is right; a told, skipped or unread answer carries no verdict, and a self-rating is its rating (never a score).
 */
export function tallyDocs(attempts: readonly AttemptRow[]) {
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
