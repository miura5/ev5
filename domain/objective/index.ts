import { z } from 'zod';

// Objective document (schema 1), as the docs gate parses the `objectives` collection.
// Seeded from the material the user names, never invented (§ev.objectives). The document id is not part of the data.
export const objectiveSchema = z.strictObject({
  schema: z.literal(1),
  writer: z.enum(['worker', 'page']),
  at: z.string().min(1),
  source: z.string().min(1),
  exam: z.string().min(1),
  num: z.number().int().min(0).optional(),
  text: z.string().min(1),
  chapters: z.union([z.string(), z.array(z.union([z.string(), z.number().int()]))]).optional(),
});
export type Objective = z.infer<typeof objectiveSchema>;

/** Validates an objective document as the docs gate stores it (schema 1); throws on anything outside it. */
export function parseObjective(raw: unknown): Objective {
  return objectiveSchema.parse(raw);
}
