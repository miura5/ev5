// domain/attempt: the `attempts` row, one append-only table for every kind of practice (table design 2.5). No
// deleted_at, no update. Every question has a set item, so (item_id, item_v) always resolves (§data.item-versions).
import { z } from "zod";
import { json, ms, prefixed, stamp, text } from "../table-row/index.ts";

export const ATTEMPT_SOURCES = ["run", "session", "note", "ask"] as const;
export const ATTEMPT_HOWS = [
  "chose",
  "typed",
  "steps",
  "told",
  "skipped",
  /** Again or Good, his own judgment of a card: kept as `answer.rating`, never as a score (Matt's call A, 2026-11-06). */
  "self",
] as const;

export const attemptRowSchema = z.strictObject({
  id: prefixed("att_"),
  item_id: text,
  item_v: z.number().int().min(1),
  set_id: text,
  session_id: z.string().min(1).nullable(),
  source: z.enum(ATTEMPT_SOURCES),
  how: z.enum(ATTEMPT_HOWS),
  answer: json.nullable(),
  /** 0 to 1, or null when ungraded (told, skipped, self, an open answer not yet read). Only a score counts toward accuracy. */
  score: z.number().min(0).max(1).nullable(),
  /** The device clock, for ordering offline answers; `at` stays the Worker's. */
  answered_at: ms,
  ...stamp,
});
export type AttemptRow = z.infer<typeof attemptRowSchema>;

/** Validates an attempts row; an attempt is only ever inserted, so v is 1. */
export function parseAttemptRow(raw: unknown): AttemptRow {
  const a = attemptRowSchema.parse(raw);
  if (a.v !== 1) throw new Error("attempts are append-only: v is 1");
  if ((a.how === "told" || a.how === "skipped") && a.score !== null)
    throw new Error(`a ${a.how} answer is not graded`);
  if (a.how === "self") {
    // A self-rating is kept as a rating, never as a score, so no reader can take it for a checked answer.
    if (a.score !== null) throw new Error("a self-rating is not graded");
    const r = (a.answer as { rating?: unknown } | null)?.rating;
    if (r !== "again" && r !== "good")
      throw new Error("a self-rating keeps its rating: again or good");
  }
  return a;
}
