import { z } from "zod";
import { ITEM_TYPES } from "../item/index.ts";
import {
  deletable,
  json,
  ms,
  prefixed,
  stamp,
  text,
  WRITERS,
} from "../table-row/index.ts";
import { SET_KINDS } from "./types.ts";

/** The `sets` row (table design 2.7): one table for the user's sets and E.V.'s; `adhoc` holds a note's or chat's questions. */
export const setTableSchema = z
  .strictObject({
    id: prefixed("set_"),
    collection_id: z.string().min(1).nullable(),
    kind: z.enum([...SET_KINDS, "adhoc"]),
    title: z.string().nullable(),
    source_kind: z.string().min(1).nullable(),
    source_id: z.string().min(1).nullable(),
    created_by: z.enum(WRITERS),
    job_id: z.string().min(1).nullable(),
    focus: json.nullable(),
    asked: z.number().int().min(1).nullable(),
    ...stamp,
    ...deletable,
  })
  .refine((s) => (s.source_kind === null) === (s.source_id === null), {
    message: "a source is a kind and an id",
  });
export type SetTableRow = z.infer<typeof setTableSchema>;

const itemColumns = {
  type: z.enum(ITEM_TYPES),
  /** The item without its id: stem, options, correct, rationales, matrix, steps, keywords. */
  body: json,
};

/** The `set_items` row; `v` bumps on every edit of `body`. */
export const setItemRowSchema = z.strictObject({
  id: prefixed("item_"),
  set_id: text,
  pos: z.number().finite(),
  ...itemColumns,
  objective_id: z.string().min(1).nullable(),
  weak_spot_id: z.string().min(1).nullable(),
  source_ref: json.nullable(),
  ...stamp,
  ...deletable,
});
export type SetItemRow = z.infer<typeof setItemRowSchema>;

/** The append-only `set_item_versions` row: the body an edit replaced. Its id is `<item_id>@<item_v>`. */
export const setItemVersionSchema = z
  .strictObject({
    id: prefixed("item_"),
    item_id: text,
    item_v: z.number().int().min(1),
    body: json,
    at: ms,
    v: z.literal(1),
  })
  .refine((r) => r.id === `${r.item_id}@${r.item_v}`, {
    message: "id is item_id@item_v",
    path: ["id"],
  });
export type SetItemVersionRow = z.infer<typeof setItemVersionSchema>;

/** Validates a sets row. */
export function parseSetTableRow(raw: unknown): SetTableRow {
  return setTableSchema.parse(raw);
}

/** Validates a set_items row. */
export function parseSetItemRow(raw: unknown): SetItemRow {
  return setItemRowSchema.parse(raw);
}

/** Validates a set_item_versions row. */
export function parseSetItemVersionRow(raw: unknown): SetItemVersionRow {
  return setItemVersionSchema.parse(raw);
}
