import type { z } from 'zod';
import { docRowSchema } from '../doc-row/index.ts';
import { examSchema } from './index.ts';

/** A `docs` row of collection `exams`: its document in `data`, plus the row's `at` (ms) and `v`. */
export const examRowSchema = docRowSchema('exams', examSchema);
export type ExamRow = z.infer<typeof examRowSchema>;

/** Validates a stored exams row; throws on a wrong collection, a bad document or an extra field. */
export function parseExamRow(raw: unknown): ExamRow {
  return examRowSchema.parse(raw);
}
