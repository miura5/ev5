import { z } from "zod";
import { deletable, json, prefixed, stamp } from "../table-row/index.ts";

/** The `notes` row (table design 2.10). `text` is the plain text rewritten on every save; search reads only it. */
export const noteTableSchema = z
  .strictObject({
    id: prefixed("note_"),
    collection_id: z.string().min(1).nullable(),
    title: z.string(),
    /** The note block format (§data.notes); its byte budget is checked by `noteWriteProblem`. */
    body: json,
    text: z.string(),
    earlier_of: z.string().min(1).nullable(),
    ...stamp,
    ...deletable,
  })
  .refine((n) => n.earlier_of === null || n.earlier_of !== n.id, {
    message: "a note is not earlier than itself",
  });
export type NoteTableRow = z.infer<typeof noteTableSchema>;

/** Validates a notes row. */
export function parseNoteTableRow(raw: unknown): NoteTableRow {
  return noteTableSchema.parse(raw);
}
