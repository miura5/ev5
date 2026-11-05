// domain/deletion: the row a delete writes to `deletions(c, id, at)`; nothing else is removed (§delete.soft).
import { z } from 'zod';

export const deletionSchema = z.strictObject({
  c: z.string().min(1),
  id: z.string().min(1),
  at: z.number().int().min(0),
});
export type Deletion = z.infer<typeof deletionSchema>;

/** Validates a deletions row; throws on a missing, extra or malformed field. */
export function parseDeletion(raw: unknown): Deletion {
  return deletionSchema.parse(raw);
}
