// domain/job-record: the stored job record (`job_records`), queued -> running -> needs you -> done or failed (§job.record).
import { z } from 'zod';

export const JOB_STATES = ['queued', 'running', 'needs-you', 'done', 'failed'] as const;

export const outputLocationSchema = z.strictObject({
  home: z.enum(['library', 'today', 'notes', 'activity']),
  id: z.string().min(1),
});

export const jobRecordSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().min(1),
  state: z.enum(JOB_STATES),
  reason: z.string().optional(),
  step: z.string().optional(),
  costCents: z.number().finite().min(0),
  output: outputLocationSchema.optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  needsYouAt: z.string().optional(),
  v: z.number().int().min(1),
});
export type JobRecordRow = z.infer<typeof jobRecordSchema>;

/** Validates a job record read from `job_records.data`; throws on a missing, extra or malformed field. */
export function parseJobRecord(raw: unknown): JobRecordRow {
  return jobRecordSchema.parse(raw);
}
