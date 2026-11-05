import type { z } from 'zod';
import { docRowSchema } from '../doc-row/index.ts';
import { objectiveSchema } from './index.ts';

/** A `docs` row of collection `objectives`: its document in `data`, plus the row's `at` (ms) and `v`. */
export const objectiveRowSchema = docRowSchema('objectives', objectiveSchema);
export type ObjectiveRow = z.infer<typeof objectiveRowSchema>;

/** Validates a stored objectives row; throws on a wrong collection, a bad document or an extra field. */
export function parseObjectiveRow(raw: unknown): ObjectiveRow {
  return objectiveRowSchema.parse(raw);
}
