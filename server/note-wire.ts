// Notes as the editor reads and writes them (CONTRACT §data.tables, §data.gate, §data.notes): a `notes` row, shown as the note
// document the page still sends and reads. A document id `n-…` is the row id `note_n-…`. A save is pinned to the version read
// (a stale one is a 409 and the screen keeps both, never a merge). Nothing is written to `docs`.
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import {
  newNoteRow,
  noteDocId,
  noteDocOf,
  noteRowId,
  noteWriteProblem,
  parseNote,
} from "../domain/index.ts";
import type { Note } from "../domain/index.ts";

export interface WireNote {
  id: string;
  v: number;
  at: number;
  data: Note;
}

const ID = /^n-[A-Za-z0-9-]{1,120}$/;

/** Every live note as its document, in id order; a row that no longer reads as a note is left out. */
export async function noteDocs(
  db: DocsD1,
  clock: () => number,
): Promise<WireNote[]> {
  const rows = await tablesRepo(db, { clock }).noteBook.list();
  return rows.flatMap((row) => {
    try {
      return [
        { id: noteDocId(row.id), v: row.v, at: row.at, data: noteDocOf(row) },
      ];
    } catch {
      return [];
    }
  });
}

/** One live note as its document, or null. */
export async function noteDocById(
  db: DocsD1,
  clock: () => number,
  id: string,
): Promise<WireNote | null> {
  const row = await tablesRepo(db, { clock }).noteBook.get(noteRowId(id));
  return row ? { id, v: row.v, at: row.at, data: noteDocOf(row) } : null;
}

export type Saved =
  | { ok: true; at: number; version: number }
  | { ok: false; status: 400 | 409; error: string };

/**
 * Saves the note document the editor sends: a create names no version, a change names the version read (a stale one is a
 * 409). A note keeps its collection; createdAt and earlierOf are written once. A document the rules turn down is a 400.
 */
export async function saveNote(
  db: DocsD1,
  clock: () => number,
  id: string,
  body: string,
  ifVersion: number | null,
): Promise<Saved> {
  const book = tablesRepo(db, { clock }).noteBook;
  try {
    if (!ID.test(id)) throw new Error(`${id} is not a note id`);
    const doc = parseNote(JSON.parse(body));
    const cur = await book.get(noteRowId(id));
    if ((cur?.v ?? null) !== ifVersion)
      return { ok: false, status: 409, error: "that changed; try again" };
    const why = noteWriteProblem(doc, cur ? noteDocOf(cur) : null);
    if (why) throw new Error(why);
    const row = newNoteRow(id, doc, cur?.collection_id ?? null);
    const saved = cur ? await book.change(row, cur.v) : await book.create(row);
    if (!saved.ok)
      return { ok: false, status: 409, error: "that changed; try again" };
    return { ok: true, at: saved.row.at, version: saved.row.v };
  } catch (e) {
    return { ok: false, status: 400, error: (e as Error).message };
  }
}
