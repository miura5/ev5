import type { z } from 'zod';
import { docRowSchema } from '../doc-row/index.ts';
import { sessionSchema } from './types.ts';

/** A `docs` row of collection `sessions`: its document in `data`, plus the row's `at` (ms) and `v`. */
export const sessionRowSchema = docRowSchema('sessions', sessionSchema);
export type SessionRow = z.infer<typeof sessionRowSchema>;

/** Validates a stored sessions row; throws on a wrong collection, a bad document or an extra field. */
export function parseSessionRow(raw: unknown): SessionRow {
  return sessionRowSchema.parse(raw);
}
