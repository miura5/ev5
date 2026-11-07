import { z } from "zod";
import { daysBetween } from "../time/index.ts";
import type { GoalRow } from "./index.ts";

// Goal document: a dated goal. Its kind is a short free-text label ("midterm", "quiz"), not a fixed list, because what
// a goal is depends on the learner's goal (§what.framing). The score and the prediction are stored elsewhere, not here.

export const goalReadSchema = z.strictObject({
  schema: z.literal(2),
  writer: z.enum(["canvas-sync", "page", "worker"]),
  at: z.string().min(1),
  source: z.string().min(1),
  title: z.string().min(1),
  kind: z.string().regex(/\S/, "kind must not be empty").max(40),
  course: z.string().optional(),
  date: z.string().nullable().optional(),
  status: z.enum(["upcoming", "done"]).optional(),
});
export type Goal = z.infer<typeof goalReadSchema>;

/** Validates a goal document; throws on anything outside its schema. */
export function parseGoal(raw: unknown): Goal {
  return goalReadSchema.parse(raw);
}

/** Whole Central days until the exam, or null when it has no date. */
export function goalDaysLeft(e: Goal, today: string): number | null {
  return e.date ? daysBetween(today, e.date) : null;
}

/** A goals row as the goal document the screens and the plan read; a row that does not fit the document has none. */
export function goalFromRow(g: GoalRow): Goal | undefined {
  try {
    return parseGoal({
      schema: 2,
      writer: g.created_by === "user" ? "page" : "worker",
      at: new Date(g.at).toISOString(),
      source: "v5/goals",
      title: g.title,
      kind: g.kind,
      ...(g.collection_id ? { course: g.collection_id } : {}),
      date: g.date,
      status: g.status === "done" ? "done" : "upcoming",
    });
  } catch {
    return undefined;
  }
}
