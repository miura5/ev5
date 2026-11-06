// The v5 rows for plans, plan_items and repeats (table design 2.9). Snake_case columns, strict, ids prefixed. The older
// camelCase shapes in ./index.ts stay until the plan tasks move their callers. Pure: the data gate writes the rows (§data.gate).
import { z } from "zod";
import {
  day,
  deletable,
  json,
  ms,
  prefixed,
  stamp,
  text,
} from "../table-row/index.ts";

const opt = z.string().min(1).nullable();
const minutes = z.number().int().min(1).max(600).nullable();
const clock = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "time must be HH:MM")
  .nullable();
const LINKED = ["note", "set", "weak_spot", "goal", "objective"] as const;

const pairedLink = <
  T extends z.ZodType<{ linked_kind: unknown; linked_id: unknown }>,
>(
  s: T,
) =>
  s.refine((r) => (r.linked_kind === null) === (r.linked_id === null), {
    message: "linked is a kind and an id",
  });

export const planTableSchema = z
  .strictObject({
    id: prefixed("plan_"),
    goal_id: text,
    job_id: opt,
    state: z.enum(["draft", "in_force", "put_away"]),
    title: z.string().nullable(),
    from_day: day,
    to_day: day,
    summary: z.string().nullable(),
    ...stamp,
    ...deletable,
  })
  .refine((p) => p.from_day <= p.to_day, {
    message: "a plan ends on or after its first day",
  });
export type PlanTableRow = z.infer<typeof planTableSchema>;

export const planItemTableSchema = pairedLink(
  z.strictObject({
    id: prefixed("pli_"),
    plan_id: opt,
    day,
    pos: z.number().finite(),
    title: text,
    minutes,
    time: clock,
    origin: z.enum(["matt", "morning", "plan"]),
    linked_kind: z.enum(LINKED).nullable(),
    linked_id: opt,
    repeat_id: opt,
    done_at: ms.nullable(),
    ...stamp,
    ...deletable,
  }),
).refine((i) => i.origin !== "plan" || i.plan_id !== null, {
  message: "an item from a plan names its plan",
});
export type PlanItemTableRow = z.infer<typeof planItemTableSchema>;

export const repeatSchema = pairedLink(
  z.strictObject({
    id: prefixed("rep_"),
    title: text,
    minutes,
    time: clock,
    /** Written by domain/time; no recurrence library. */
    rule: json,
    from_day: day,
    to_day: day.nullable(),
    linked_kind: z.enum(LINKED).nullable(),
    linked_id: opt,
    ...stamp,
    ...deletable,
  }),
).refine((r) => r.to_day === null || r.from_day <= r.to_day, {
  message: "a repeat ends on or after its first day",
});
export type RepeatRow = z.infer<typeof repeatSchema>;

/** Validates a plans row (at most one in force per goal is the database's index and the gate's check). */
export const parsePlanTableRow = (raw: unknown): PlanTableRow =>
  planTableSchema.parse(raw);
/** Validates a plan_items row; (repeat_id, day) uniqueness is checked across rows by the gate (§data.repeat). */
export const parsePlanItemTableRow = (raw: unknown): PlanItemTableRow =>
  planItemTableSchema.parse(raw);
/** Validates a repeats row. */
export const parseRepeatRow = (raw: unknown): RepeatRow =>
  repeatSchema.parse(raw);

/** Throws when two plan_items share a repeat and a day (§data.repeat). */
export function checkRepeatDays(items: readonly PlanItemTableRow[]): void {
  const seen = new Set<string>();
  for (const i of items) {
    if (i.repeat_id === null || i.deleted_at !== null) continue;
    const k = `${i.repeat_id}\u0000${i.day}`;
    if (seen.has(k))
      throw new Error(`repeat placed twice: ${i.repeat_id} on ${i.day}`);
    seen.add(k);
  }
}

/** Throws when more than one plan is in force for a goal. */
export function checkOneInForce(plans: readonly PlanTableRow[]): void {
  const seen = new Set<string>();
  for (const p of plans) {
    if (p.state !== "in_force" || p.deleted_at !== null) continue;
    if (seen.has(p.goal_id))
      throw new Error(`two plans in force for ${p.goal_id}`);
    seen.add(p.goal_id);
  }
}
