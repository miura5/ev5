// domain/plan: the study plan job's rules and the older exam-keyed row shapes below (camelCase, `examId`), kept until the
// callers move. The tables that exist are `plans` and `plan_items` (migration 0007): their rows are ./table.ts, which also
// builds them from a job's plan (`planTableWrite`); the data gate writes them (§data.gate) and a plan item is unique by
// repeat and day (§data.repeat). The code validates and the model only arranges (§model.output). Pure: no SQL here.
import { z } from "zod";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const planSchema = z.strictObject({
  id: z.string().min(1),
  examId: z.string().min(1),
  jobId: z.string().min(1),
  status: z.enum(["approved", "put_away"]),
  summary: z.string(),
  at: z.number().int().min(0),
});
export type PlanRow = z.infer<typeof planSchema>;

export const planItemSchema = z.strictObject({
  id: z.string().min(1),
  planId: z.string().min(1),
  /** The repeat key: one per planned task, so a task that lands on a day is written once. */
  repeat: z.string().min(1),
  day: z.string().regex(DAY, "day must be YYYY-MM-DD"),
  title: z.string().min(1),
  minutes: z.number().int().min(10).max(120),
  weakSpotId: z.string().min(1).nullable(),
  pos: z.number().int().min(0),
});
export type PlanItemRow = z.infer<typeof planItemSchema>;

/** The tasks of a validated plan, as the study plan job's output shape (jobs/study-plan checks the semantic rules). */
export type PlanTasks = {
  summary: string;
  tasks: {
    date: string;
    title: string;
    minutes: number;
    weakSpotId?: string;
  }[];
};

/** Validates a plans row; throws on a missing, extra or malformed field. */
export function parsePlanRow(raw: unknown): PlanRow {
  return planSchema.parse(raw);
}

/** Validates a plan_items row; uniqueness across rows is checked by `checkUnique`. */
export function parsePlanItemRow(raw: unknown): PlanItemRow {
  return planItemSchema.parse(raw);
}

/** One plan per job, so a retried save writes the same row. */
export const planId = (jobId: string): string => `plan-${jobId}`;

/** Throws when two items share a repeat and a day (§data.repeat). */
export function checkUnique(items: readonly PlanItemRow[]): void {
  const seen = new Set<string>();
  for (const i of items) {
    const key = `${i.planId}\u0000${i.repeat}\u0000${i.day}`;
    if (seen.has(key))
      throw new Error(`plan item repeated: ${i.repeat} on ${i.day}`);
    seen.add(key);
  }
}

/** The last day a plan has a task on, or undefined when it has none. Days are Central dates (YYYY-MM-DD), which sort as text. */
export const lastDay = (days: readonly string[]): string | undefined =>
  days.reduce<string | undefined>(
    (m, d) => (m === undefined || d > m ? d : m),
    undefined,
  );

/** True when every day of the plan is before `today` (Central): nothing in it can still be done. A plan with no days is not ended. */
export const planEnded = (days: readonly string[], today: string): boolean => {
  const last = lastDay(days);
  return last !== undefined && last < today;
};

/** What Matt is told when he approves a plan that has already ended (an offer to plan again follows it). */
export const endedReason = (last: string): string =>
  `This plan's days have all passed (its last day was ${last}), so it cannot be approved. Plan again to get a plan from today.`;

export type PlanWrite = { plan: PlanRow; items: PlanItemRow[] };

/** The one approve path: the plan row plus one item per task, each with a repeat key from its place in the plan. */
export function approvePlan(input: {
  jobId: string;
  examId: string;
  plan: PlanTasks;
  at: number;
}): PlanWrite {
  const id = planId(input.jobId);
  const items = input.plan.tasks.map((t, n) =>
    parsePlanItemRow({
      id: `${id}:t${n + 1}:${t.date}`,
      planId: id,
      repeat: `t${n + 1}`,
      day: t.date,
      title: t.title,
      minutes: t.minutes,
      weakSpotId: t.weakSpotId ?? null,
      pos: n,
    }),
  );
  checkUnique(items);
  const plan = parsePlanRow({
    id,
    examId: input.examId,
    jobId: input.jobId,
    status: "approved",
    summary: input.plan.summary,
    at: input.at,
  });
  return { plan, items };
}

/** The one put-away path: the plan row is kept, marked put away, and puts nothing on Today. */
export function putAwayPlan(input: {
  jobId: string;
  examId: string;
  summary: string;
  at: number;
}): PlanWrite {
  const plan = parsePlanRow({
    id: planId(input.jobId),
    examId: input.examId,
    jobId: input.jobId,
    status: "put_away",
    summary: input.summary,
    at: input.at,
  });
  return { plan, items: [] };
}

/**
 * What a decision does given the plan already saved for the job: 'write' when none, 'same' for a retried step that repeats
 * the saved decision (no second write), and a throw for the opposite decision (a plan settled one way is not unsettled).
 */
export function settle(
  saved: PlanRow | undefined,
  decision: "approve" | "put_away",
): "write" | "same" {
  if (!saved) return "write";
  const want = decision === "approve" ? "approved" : "put_away";
  if (saved.status === want) return "same";
  throw new Error(
    `This plan was already ${saved.status === "approved" ? "approved" : "put away"}.`,
  );
}
