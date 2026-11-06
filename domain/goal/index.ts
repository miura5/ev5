// domain/goal: the `goals` row (an exam is one kind of goal). Kinds are data, the date is optional, and Canvas columns
// wait until after cutover (per the table-design decision). Which plan, objectives or material a goal has is reached through other rows.
import { z } from "zod";
import {
  day,
  deletable,
  prefixed,
  stamp,
  text,
  WRITERS,
} from "../table-row/index.ts";

export const goalRowSchema = z.strictObject({
  id: prefixed("goal_"),
  collection_id: z.string().min(1).nullable(),
  title: text,
  kind: z.string().regex(/\S/, "kind must not be empty").max(40),
  date: day.nullable(),
  status: z.enum(["open", "done"]),
  score: z.number().min(0).max(1).nullable(),
  created_by: z.enum(WRITERS),
  ...stamp,
  ...deletable,
});
export type GoalRow = z.infer<typeof goalRowSchema>;

/** Validates a goals row; a score belongs to a done goal only. */
export function parseGoalRow(raw: unknown): GoalRow {
  const g = goalRowSchema.parse(raw);
  if (g.score !== null && g.status !== "done")
    throw new Error("a score is set only when the goal is done");
  return g;
}
