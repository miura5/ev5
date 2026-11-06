// What a study attempt records, as an `attempts` row (server/handlers-study.ts).
// Again or Good is a self-rating: kept as a rating, never as a score or `correct`, so it counts as studied but never
// toward accuracy; only checked answers do (Matt's call A, 2026-11-06).

/** A checked answer: right or not, the model's score for an open answer, the options chosen or the number given. */
export type Graded = {
  correct?: boolean;
  score?: number;
  chosen?: number[];
  value?: number;
};

/** A "just tell me", his own Again or Good, or an answer checked against its key or graded. */
export type Entry =
  | "told"
  | { text: string; rating: "again" | "good" }
  | { text: string; g: Graded };

const withText = <T extends Record<string, unknown>>(o: T, text: string) =>
  text ? { ...o, text } : o;

/** The attempts row's how, answer and score; a self-rating keeps its rating and has no score. */
export function rowOf(open: boolean, how: Entry) {
  if (how === "told")
    return { how: "told" as const, answer: null, score: null };
  if ("rating" in how)
    return {
      how: "self" as const,
      answer: withText({ rating: how.rating }, how.text),
      score: null,
    };
  const g = how.g;
  return {
    how: !open && g.chosen ? ("chose" as const) : ("typed" as const),
    answer: withText(
      {
        ...(g.chosen ? { chosen: g.chosen } : {}),
        ...(g.value === undefined ? {} : { value: g.value }),
      },
      how.text,
    ),
    score: g.score ?? (g.correct === undefined ? null : g.correct ? 1 : 0),
  };
}
