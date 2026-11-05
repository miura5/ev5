// domain/job-plan: a job's saved plan, scope, result or failure, `job_plans(job_id, kind, body, at)`; one row per job and kind.
import { z } from 'zod';

export const jobPlanSchema = z.strictObject({
  jobId: z.string().min(1),
  kind: z.string().min(1),
  /** The saved content; each job validates its own body with its own schema. */
  body: z.unknown(),
  at: z.string().min(1),
});
export type JobPlanRow = z.infer<typeof jobPlanSchema>;

/** Validates a job_plans row; throws on a missing, extra or malformed field. */
export function parseJobPlanRow(raw: unknown): JobPlanRow {
  return jobPlanSchema.parse(raw);
}
