// domain/doc-row: the shape of a row of `docs(c, id, data, at, v)`, where the kinds that have no table of their own live
// (exam, objective, weak spot, set, session, note). `data` is the document, parsed by its kind's schema; `at` is the
// row's write time in ms and `v` its version under §data.protocol. Each kind's folder builds its row from this.
import { z } from 'zod';

export function docRowSchema<C extends string, D extends z.ZodType>(c: C, data: D) {
  return z.strictObject({
    c: z.literal(c),
    id: z.string().min(1),
    data,
    at: z.number().int().min(0),
    v: z.number().int().min(1),
  });
}
