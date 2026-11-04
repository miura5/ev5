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
  rating: "again" | "good",
  attempt: string,
  now: Date,
  rand: string,
): AnswerWrite {
  const iso = now.toISOString().slice(0, 19) + "Z";
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const key = `page-${stamp}-${rand.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const text = attempt.trim().slice(0, 600);
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
            correct: rating === "good",
            at: iso,
            ...(text ? { text } : {}),
          },
        },
      },
    },
  };
}
