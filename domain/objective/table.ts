import { z } from "zod";
import {
  deletable,
  json,
  prefixed,
  stamp,
  text,
  WRITERS,
} from "../table-row/index.ts";

/** The `objectives` row (table design 2.3): no goal id, since a link row says which goal it is on. */
export const objectiveTableSchema = z.strictObject({
  id: prefixed("obj_"),
  collection_id: text,
  num: z.number().int().min(0).nullable(),
  text,
  chapters: json.nullable(),
  source_ref: json.nullable(),
  created_by: z.enum(WRITERS),
  ...stamp,
  ...deletable,
});
export type ObjectiveTableRow = z.infer<typeof objectiveTableSchema>;

/** Validates an objectives row. */
export function parseObjectiveTableRow(raw: unknown): ObjectiveTableRow {
  return objectiveTableSchema.parse(raw);
}
