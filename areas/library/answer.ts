/** One practice answer as an `answers` document (ev4 schema 2: setId, then item id, then attempt key, append-only). */
export interface AnswerWrite {
  id: string;
  doc: Record<string, unknown>;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Each answer is its own new document, so queueing is always a create: a 409 on replay means this exact answer is
 * already recorded. `rand` keeps two answers in the same second apart.
 */
export function buildAnswer(
  setId: string,
  itemId: string,
  rating: "again" | "good" | "told",
  attempt: string,
  now: Date,
  rand: string,
): AnswerWrite {
  const iso = now.toISOString().slice(0, 19) + "Z";
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const key = `page-${stamp}-${rand.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const full = attempt.trim();
  // The ev4 answer document keeps 600 characters of text; a longer answer says so, with its length (never cut silently).
  const text = full.slice(0, 600);
  return {
    id: `${setId}-${key}`,
    doc: {
      schema: 2,
      writer: "page",
      at: iso,
      source: "v5/library",
      setId,
      answers: {
        [itemId]: {
          [key]: {
            // "told" is a "just tell me" tap: it has no right or wrong, only the outcome
            // Again or Good is his own judgment, kept as a rating and never as `correct` (so it never counts toward accuracy).
            ...(rating === "told" ? { outcome: "told" } : { rating }),
            at: iso,
            ...(text ? { text } : {}),
            ...(full.length > 600
              ? { textCut: true, textLength: full.length }
              : {}),
          },
        },
      },
    },
  };
}
