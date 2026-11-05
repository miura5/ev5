import type { z } from 'zod';
import { docRowSchema } from '../doc-row/index.ts';
import { weakSpotSchema } from './types.ts';

/** A `docs` row of collection `weakspots`: its document in `data`, plus the row's `at` (ms) and `v`. */
export const weakSpotRowSchema = docRowSchema('weakspots', weakSpotSchema);
export type WeakSpotRow = z.infer<typeof weakSpotRowSchema>;

/** Validates a stored weakspots row; throws on a wrong collection, a bad document or an extra field. */
export function parseWeakSpotRow(raw: unknown): WeakSpotRow {
  return weakSpotRowSchema.parse(raw);
}
