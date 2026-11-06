// domain/job-plan: a job's saved plan, scope, result or failure, `job_plans(job_id, kind, body, at)`; one row per job and kind.
import { z } from 'zod';

export const jobPlanSchema = z.strictObject({
  jobId: z.string().min(1),
  kind: z.string().min(1),
  /** The saved content; each job validates its own body with its own schema. */
  body: z.unknown(),
  at: z.number().int().min(0),
});
export type JobPlanRow = z.infer<typeof jobPlanSchema>;

/** Validates a job_plans row; throws on a missing, extra or malformed field. */
export function parseJobPlanRow(raw: unknown): JobPlanRow {
  return jobPlanSchema.parse(raw);
}

/** A `job_plans` row as D1 returns it: the body is the JSON text the writer saved. */
const storedPlanSchema = z.object({
  job_id: z.string().min(1),
  body: z.string(),
});

/** Parses a stored job_plans row on read and returns its decoded body; throws when the row or its JSON is malformed. */
export function parseStoredPlanBody(raw: unknown): unknown {
  return JSON.parse(storedPlanSchema.pick({ body: true }).parse(raw).body);
}

/** Parses a stored job_plans row (with its job id) on read; throws when the row or its JSON is malformed. */
export function parseStoredPlan(raw: unknown): {
  jobId: string;
  body: unknown;
} {
  const r = storedPlanSchema.parse(raw);
  return { jobId: r.job_id, body: JSON.parse(r.body) };
}
