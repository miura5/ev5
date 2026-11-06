// Notes (CONTRACT §cmd.registry, §data.protocol): a note is a row of `notes` written on the tables gate with the version
// read, so a stale save is a 409 and the screen keeps both (the outbox's job). A note's collection is its row's
// `collection_id`, mirrored in a `memberships` row for the collection screens. "New here" makes a note, set, date or collection inside the collection Matt is looking at.
import {
  centralDate,
  newNoteId,
  newNoteRow,
  noteBlocks,
  noteDoc,
  noteDocOf,
  noteRowId,
  noteWriteProblem,
  parseNote,
} from "../domain/index.ts";
import type { Note, NoteTableRow } from "../domain/index.ts";
import { tablesRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { colKey } from "./ids.ts";
import { iso } from "./handlers-edit.ts";

const SOURCE = "v5/notes";
/** A note document id, as server/note-wire.ts accepts it. */
const NOTE_ID = /^n-[A-Za-z0-9-]{1,120}$/;

interface NoteSaveInput {
  id: string;
  body: string;
  if_version?: number;
  title?: string;
  earlier_of?: string;
}

/** The body as blocks: a JSON list of blocks as the editor sends, else plain text with a paragraph per line. */
function blocksOf(body: string): unknown {
  try {
    const v: unknown = JSON.parse(body);
    if (Array.isArray(v)) return v;
  } catch {
    // plain text
  }
  return body
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((text) => ({ type: "p", runs: [{ text }] }));
}

async function place(x: HandlerCtx, itemC: string, id: string, to: string) {
  const t = tablesRepo(x.db, { clock: x.clock });
  if (!(await t.collectionRows.get(to)))
    throw new CommandError(404, `no collection ${to}`);
  const cur = await t.memberships.get(itemC, id);
  const r = await t.memberships.save(
    { itemC, itemId: id, collectionId: to },
    cur ? cur.v : null,
  );
  if (!r.ok) throw new CommandError(409, "that item changed; try again");
}

/** Puts an item in a collection (the set and note handlers share it). */
export { place };

/** The row's own columns, for a change that keeps all but one. */
const fieldsOf = ({ at: _a, v: _v, deleted_at: _d, ...f }: NoteTableRow) => f;

const needNote = async (x: HandlerCtx, id: string) => {
  const row = await tablesRepo(x.db, { clock: x.clock }).noteBook.get(
    noteRowId(id),
  );
  if (!row) throw new CommandError(404, `no notes entry ${id}`);
  return row;
};

export const noteHandlers: Record<string, CommandHandler> = {
  "note.create": async (i: { collection?: string }, _c, x) => {
    const at = iso(x.clock());
    const id = newNoteId(at, x.newId().replace(/-/g, ""));
    if (
      i.collection &&
      !(await tablesRepo(x.db, { clock: x.clock }).collectionRows.get(
        i.collection,
      ))
    )
      throw new CommandError(404, `no collection ${i.collection}`);
    const doc = noteDoc(null, { blocks: [], at, source: SOURCE });
    const made = await tablesRepo(x.db, { clock: x.clock }).noteBook.create(
      newNoteRow(id, doc, i.collection ?? null),
    );
    if (!made.ok) throw new CommandError(409, "that changed; try again");
    if (i.collection) await place(x, "notes", id, i.collection);
    return { id, ...(i.collection ? { collection: i.collection } : {}) };
  },

  // Pinned saves (§data.protocol): `if_version` is the version read, 409 when stale; 0 means "a new note" (409 when it
  // exists). With no `if_version` a note that exists is saved on its current version and a missing one is a 404.
  "note.save": async (i: NoteSaveInput, _c, x) => {
    const book = tablesRepo(x.db, { clock: x.clock }).noteBook;
    const cur = await book.get(noteRowId(i.id));
    const stale = new CommandError(409, "that changed; try again");
    if (i.if_version !== undefined && i.if_version !== (cur?.v ?? 0)) throw stale;
    if (!cur && i.if_version === undefined)
      throw new CommandError(404, `no notes entry ${i.id}`);
    let prev: Note | null = null;
    if (cur) {
      try {
        prev = noteDocOf(cur);
      } catch {
        throw new CommandError(409, `${i.id} is not a note this app can edit`);
      }
    } else if (!NOTE_ID.test(i.id)) throw new CommandError(400, `${i.id} is not a note id`);
    let row;
    try {
      const doc = noteDoc(prev, {
        blocks: noteBlocks(blocksOf(i.body)),
        at: iso(x.clock()),
        source: SOURCE,
      });
      if (i.title !== undefined) doc.title = i.title;
      if (!prev && i.earlier_of) doc.earlierOf = i.earlier_of;
      const checked = parseNote(doc);
      const why = noteWriteProblem(checked, prev);
      if (why) throw new Error(why);
      row = newNoteRow(i.id, checked, cur?.collection_id ?? null);
    } catch {
      throw new CommandError(400, "that is not a note body");
    }
    const saved = cur
      ? await book.change(row, cur.v)
      : await book.create(row);
    if (!saved.ok) throw stale;
    return { id: i.id, version: saved.row.v };
  },

  "note.move": async (i: { id: string; collection: string }, _c, x) => {
    const cur = await needNote(x, i.id);
    await place(x, "notes", i.id, i.collection);
    const moved = await tablesRepo(x.db, { clock: x.clock }).noteBook.change(
      { ...fieldsOf(cur), collection_id: i.collection },
      cur.v,
    );
    if (!moved.ok) throw new CommandError(409, "that changed; try again");
    return { id: i.id, collection: i.collection };
  },
};

/** "New … here": the made thing lands in the collection (a date has none, so it is added as an ordinary date). */
export const newHereHandler = (
  all: () => Record<string, CommandHandler>,
): Record<string, CommandHandler> => ({
  "collection.new_here": async (
    i: { collection: string; kind: "note" | "set" | "date" | "collection" },
    caller,
    x,
  ) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    const parent = await t.collectionRows.get(i.collection);
    if (!parent) throw new CommandError(404, `no collection ${i.collection}`);
    const run = (name: string, input: unknown) => {
      const h = all()[name];
      if (!h) throw new CommandError(501, `${name} has no handler yet`);
      return h(input as never, caller, x);
    };
    if (i.kind === "note")
      return run("note.create", { collection: i.collection });
    if (i.kind === "set")
      return run("set.create", {
        title: "New set",
        collection: i.collection,
      });
    if (i.kind === "date")
      return run("date.create", {
        title: "New date",
        date: centralDate(x.clock()),
      });
    // One level of nesting only (§data.membership): inside a sub-collection it goes beside it.
    const pos = (await t.collectionRows.list()).reduce(
      (m, c) => Math.max(m, c.pos + 1),
      0,
    );
    const r = await t.collectionRows.save(
      {
        id: colKey(x.newId()),
        title: "New collection",
        parent_id: parent.parent_id ?? parent.id,
        pos,
      },
      null,
    );
    if (!r.ok) throw new CommandError(409, "that collection already exists");
    return { collection: r.row };
  },
});
