import type { z } from 'zod';
import { docRowSchema } from '../doc-row/index.ts';
import { studySetSchema } from './types.ts';

/** A `docs` row of collection `sets`: its document in `data`, plus the row's `at` (ms) and `v`. */
export const setRowSchema = docRowSchema('sets', studySetSchema);
export type SetRow = z.infer<typeof setRowSchema>;

/** Validates a stored sets row; throws on a wrong collection, a bad document or an extra field. */
export function parseSetRow(raw: unknown): SetRow {
  return setRowSchema.parse(raw);
}
