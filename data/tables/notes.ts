// The one writer of notes on the tables gate (§data.tables, §data.gate): a note is a row in `notes`, saved at the version read
// (a stale one is a conflict, never a merge, §data.notes). Search reads only the plain-text column (§data.search): a SQL `LIKE`
// over `text`, no virtual table.
import { NOTE_MAX, type NoteTableRow } from "../../domain/index.ts";
import type { D1Like } from "../d1.ts";
import type { TablesOptions } from "./core.ts";
import { WriteRefused } from "./gate.ts";
import { kindsRepo, type Fields } from "./kinds.ts";

/** A note the search found: enough to rank a passage without reading its body. */
export interface NoteHit {
  id: string;
  title: string;
  text: string;
  collection_id: string | null;
}

/** The note rule beyond the row shape: a body holds at most the note budget (§data.notes), whatever wrote it. */
function budgeted(n: Fields<NoteTableRow>): Fields<NoteTableRow> {
  const bytes = new TextEncoder().encode(JSON.stringify(n.body)).length;
  if (bytes > NOTE_MAX.documentBytes)
    throw new WriteRefused(
      "notes",
      `a note holds at most ${NOTE_MAX.documentBytes} bytes; this one is ${bytes}`,
    );
  return n;
}

export function notesRepo(db: D1Like, opts: TablesOptions) {
  const k = kindsRepo(db, opts);
  return {
    noteBook: {
      get: (id: string, o: { deleted?: boolean } = {}) => k.notes.get(id, o),
      /** Every live note, in id order. */
      list: () => k.notes.list(),
      /** Creates a note (a new id; a repeated id is a conflict). */
      create: async (n: Fields<NoteTableRow>) =>
        k.notes.save(budgeted(n), null),
      /** Changes a note at the version read. */
      change: async (n: Fields<NoteTableRow>, ifVersion: number) =>
        k.notes.save(budgeted(n), ifVersion),
      /** The live notes whose text matches any of the `LIKE` patterns (see domain/search `likePatterns`). */
      search: async (patterns: readonly string[]): Promise<NoteHit[]> => {
        if (!patterns.length) return [];
        const where = patterns.map(() => "text LIKE ?").join(" OR ");
        const { results } = await db
          .prepare(
            `SELECT id, title, text, collection_id FROM notes WHERE deleted_at IS NULL AND (${where}) ORDER BY id`,
          )
          .bind(...patterns)
          .all<{
            id: string;
            title: string;
            text: string;
            collection_id: string | null;
          }>();
        return results.map((r) => ({
          id: r.id,
          title: r.title,
          text: r.text,
          collection_id: r.collection_id ?? null,
        }));
      },
    },
  };
}
