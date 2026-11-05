import type { z } from 'zod';
import { docRowSchema } from '../doc-row/index.ts';
import { noteSchema } from './types.ts';

/** A `docs` row of collection `notes`: its document in `data`, plus the row's `at` (ms) and `v`. */
export const noteRowSchema = docRowSchema('notes', noteSchema);
export type NoteRow = z.infer<typeof noteRowSchema>;

/** Validates a stored notes row; throws on a wrong collection, a bad document or an extra field. */
export function parseNoteRow(raw: unknown): NoteRow {
  return noteRowSchema.parse(raw);
}
