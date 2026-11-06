// Notes (CONTRACT §cmd.registry, §data.protocol): a note is an ev4 `notes` document written through the docs protocol with
// the version read, so a stale save is a 409 and the screen keeps both (the outbox's job). A note's collection is a
// `memberships` row. "New here" makes a note, set, date or collection inside the collection Matt is looking at.
import {
  centralDate,
  newNoteId,
  noteBlocks,
  noteDoc,
  parseNote,
} from "../domain/index.ts";
import { tablesRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { colKey } from "./ids.ts";
import { iso, need, put } from "./handlers-edit.ts";

const SOURCE = "v5/notes";

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
    await put(x, "notes", id, doc, null);
    if (i.collection) await place(x, "notes", id, i.collection);
    return { id, ...(i.collection ? { collection: i.collection } : {}) };
  },

  "note.save": async (i: { id: string; body: string }, _c, x) => {
    const cur = await need(x, "notes", i.id);
    let prev;
    try {
      prev = parseNote(cur.data);
    } catch {
      throw new CommandError(409, `${i.id} is not a note this app can edit`);
    }
    let doc;
    try {
      doc = noteDoc(prev, {
        blocks: noteBlocks(blocksOf(i.body)),
        at: iso(x.clock()),
        source: SOURCE,
      });
      parseNote(doc);
    } catch {
      throw new CommandError(400, "that is not a note body");
    }
    return { id: i.id, version: await put(x, "notes", i.id, doc, cur.v) };
  },

  "note.move": async (i: { id: string; collection: string }, _c, x) => {
    await need(x, "notes", i.id);
    await place(x, "notes", i.id, i.collection);
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
