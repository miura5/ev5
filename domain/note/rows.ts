import { writeProblem } from "./parse.ts";
import type { NoteTableRow } from "./table.ts";
import { noteSchema, type Note } from "./types.ts";

// A note as a row (§data.tables, §data.notes). The row's id is the document id with `note_` in front. The title, the earlier
// link and the plain text are columns; `body` is the block format only (§data.notes): the blocks and the two stamps
// createdAt and editedAt. The old document fields (source, course, label, archivedAt, discardedAt) are not stored; a
// stored body that still carries them is read without them. `at` is the row's own stamp.
/** The `source` every note reads back with: the row no longer stores it. */
const NOTE_SOURCE = "E.V. Home";
const iso = (ms: number) => new Date(ms).toISOString();

export const noteRowId = (docId: string) => `note_${docId}`;
export const noteDocId = (rowId: string) => rowId.slice(5);

/** The `notes` columns a caller supplies; the gate sets `at`, `v` and `deleted_at`. */
export type NewNoteRow = Omit<NoteTableRow, "at" | "v" | "deleted_at">;

/** The words of a note, a line per block: the only column search reads (§data.search). */
export function noteText(blocks: Note["blocks"]): string {
  return blocks.map((b) => b.runs.map((r) => r.text).join("")).join("\n");
}

/**
 * A note document as its row. The document must pass the note rules (shape and 256 KB); `collectionId` is the note's
 * collection, which the document does not carry.
 */
export function newNoteRow(
  docId: string,
  doc: Note,
  collectionId: string | null,
): NewNoteRow {
  const why = writeProblem(doc, null);
  if (why) throw new Error(why);
  const { title, earlierOf, blocks, createdAt, editedAt } = doc;
  const body = {
    blocks,
    createdAt,
    ...(editedAt === undefined ? {} : { editedAt }),
  };
  return {
    id: noteRowId(docId),
    collection_id: collectionId,
    title,
    body,
    text: noteText(doc.blocks),
    earlier_of: earlierOf === undefined ? null : noteRowId(earlierOf),
  };
}

/** The document the editor reads (`GET /docs?collection=notes`), built from the row. */
export function noteDocOf(row: NoteTableRow): Note {
  const { blocks, createdAt, editedAt } = row.body as Pick<
    Note,
    "blocks" | "createdAt" | "editedAt"
  >;
  return noteSchema.parse({
    blocks,
    createdAt,
    ...(editedAt === undefined ? {} : { editedAt }),
    schema: 1,
    writer: "page",
    source: NOTE_SOURCE,
    at: iso(row.at),
    title: row.title,
    ...(row.earlier_of === null
      ? {}
      : { earlierOf: noteDocId(row.earlier_of) }),
  });
}
