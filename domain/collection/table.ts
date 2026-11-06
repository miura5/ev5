import { z } from "zod";
import { deletable, prefixed, stamp, text } from "../table-row/index.ts";

/** The `collections` row (table design 2.1): generic, so no course facts. One level of nesting is checked on write. */
export const collectionRowSchema = z
  .strictObject({
    id: prefixed("col_"),
    title: text,
    parent_id: z.string().min(1).nullable(),
    pos: z.number().finite(),
    ...stamp,
    ...deletable,
  })
  .refine((c) => c.parent_id !== c.id, {
    message: "a collection cannot be its own parent",
    path: ["parent_id"],
  });
export type CollectionRow = z.infer<typeof collectionRowSchema>;

/** Validates a collections row. */
export function parseCollectionRow(raw: unknown): CollectionRow {
  return collectionRowSchema.parse(raw);
}
