// domain/system-doc: a row of `system_docs(name, data, at)`: a named document E.V. keeps for itself; `data` is JSON text.
import { z } from 'zod';

const isJson = (s: string): boolean => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
};

export const systemDocSchema = z.strictObject({
  name: z.string().min(1),
  data: z.string().refine(isJson, 'data must be JSON text'),
  at: z.number().int().min(0),
});
export type SystemDoc = z.infer<typeof systemDocSchema>;

/** @public Validates a system_docs row; throws on a missing, extra or malformed field. */
export function parseSystemDoc(raw: unknown): SystemDoc {
  return systemDocSchema.parse(raw);
}
