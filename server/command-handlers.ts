// The instant commands' handlers (CONTRACT §cmd.registry): each runs for a caller the route already checked.
// Table-backed commands use the repositories; commands a screen carries out itself (open, theme, navigation) are
// acknowledged here so the route never answers 501 for them. Nothing here removes a document (§delete.who).
import { docsRepo, tablesRepo } from "../data/index.ts";
import { NOTE_MAX, itemKey, noteRowId } from "../domain/index.ts";
import type { DocsD1 } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import { colKey } from "./ids.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { dateHandlers } from "./handlers-dates.ts";
import { draftHandlers } from "./handlers-drafts.ts";
import { jobHandlers } from "./handlers-jobs.ts";
import { noteHandlers, newHereHandler } from "./handlers-notes.ts";
import { planHandlers } from "./handlers-plan.ts";
import { proposalHandlers } from "./handlers-proposal.ts";
import { sessionHandlers } from "./handlers-session.ts";
import { setHandlers } from "./handlers-sets.ts";
import { studyHandlers } from "./handlers-study.ts";
import { prepPlanHandlers } from "./handlers-prepplan.ts";
import { weakHandlers } from "./handlers-weak.ts";

export { CommandError };
export type { CommandHandler } from "./handlers-core.ts";

type Ref = { id: string };

/** The collection a document id lives in; an id used in two collections must be named by the caller. */
async function collectionOf(db: DocsD1, id: string): Promise<string> {
  const { results } = await db
    .prepare("SELECT DISTINCT c FROM docs WHERE id = ? LIMIT 2")
    .bind(id)
    .all<{ c: string }>();
  if (!results.length) {
    // A note made since the notes moved to their table has no document (§data.tables).
    const note = await db
      .prepare("SELECT 1 AS n FROM notes WHERE id = ?")
      .bind(noteRowId(id))
      .all<{ n: number }>();
    if (note.results.length) return "notes";
    throw new CommandError(404, `no item ${id}`);
  }
  if (results.length > 1)
    throw new CommandError(409, `${id} is in two collections`);
  return (results[0] as { c: string }).c;
}

/** The collection name an item is pinned, moved and renamed under. A set or a goal is a row, not a document, so its
 * id names its table: `set_` is "sets" and `goal_` is "exams" (the goal as its exam document, as GET /docs reads it). */
async function placeOf(x: HandlerCtx, id: string): Promise<string> {
  const t = tablesRepo(x.db, { clock: x.clock });
  if (id.startsWith("set_") && (await t.sets.get(id))) return "sets";
  if (id.startsWith("goal_") && (await t.goals.get(id))) return "exams";
  return collectionOf(x.db, id);
}

const ack = async () => ({ client: true });

export const commandHandlers: Record<string, CommandHandler> = {
  ...planHandlers,
  ...dateHandlers,
  ...draftHandlers,
  ...proposalHandlers(() => commandHandlers),
  ...jobHandlers,
  ...noteHandlers,
  ...newHereHandler(() => commandHandlers),
  ...sessionHandlers,
  ...weakHandlers,
  ...setHandlers,
  ...studyHandlers,
  ...prepPlanHandlers,
  // A chat turn (effect 'chat'): the same code path as POST /api/v1/ask, so spend, ceilings and citations are shared.
  "ask.send": async (i: { text: string; chat_id?: string }, _caller, ctx) => {
    if (!ctx.ask) throw new CommandError(503, "asking is not available here");
    return ctx.ask(i.text, i.chat_id);
  },
  // Carried out by the screen; the server only agrees.
  "item.open": ack,
  "palette.open": ack,
  "palette.to_ev": ack,
  "theme.toggle": ack,
  "notes.shortcuts": ack,
  "nav.go": ack,

  "item.pin": async (i: Ref, _c, x) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    const c = await placeOf(x, i.id);
    const pins = await t.pins.list();
    const own = pins.find((p) => p.targetC === c && p.targetId === i.id);
    const pos = own
      ? own.pos
      : pins.reduce((m, p) => Math.max(m, p.pos + 1), 0);
    return { pin: await t.pins.set(c, i.id, pos) };
  },
  "item.unpin": async (i: Ref, _c, x) => ({
    removed: await tablesRepo(x.db, { clock: x.clock }).pins.remove(
      await placeOf(x, i.id),
      i.id,
    ),
  }),
  "item.move": async (i: Ref & { collection: string }, _c, x) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    const c = await placeOf(x, i.id);
    if (!(await t.collectionRows.get(i.collection)))
      throw new CommandError(404, `no collection ${i.collection}`);
    // A set on its table keeps its collection on its own row, the one place a source scope reads (domain/search).
    const setRow = c === "sets" ? await t.sets.get(i.id) : null;
    if (setRow) {
      const { at: _a, v: _v, deleted_at: _d, ...f } = setRow;
      const m = await t.sets.save(
        { ...f, collection_id: i.collection },
        setRow.v,
      );
      if (!m.ok) throw new CommandError(409, "that item changed; try again");
      return { set: { id: i.id, collectionId: i.collection } };
    }
    if (c === "notes") {
      // A note keeps its collection on its own row; GET /memberships reads it from there.
      const note = await t.noteBook.get(noteRowId(i.id));
      if (!note) throw new CommandError(404, `no item ${i.id}`);
      const { at: _a, v: _v, deleted_at: _d, ...f } = note;
      const m = await t.noteBook.change(
        { ...f, collection_id: i.collection },
        note.v,
      );
      if (!m.ok) throw new CommandError(409, "that item changed; try again");
      return { note: { id: i.id, collectionId: i.collection } };
    }
    const cur = await t.memberships.get(c, i.id);
    const r = await t.memberships.save(
      { itemC: c, itemId: i.id, collectionId: i.collection },
      cur ? cur.v : null,
    );
    if (!r.ok) throw new CommandError(409, "that item changed; try again");
    return { membership: r.row };
  },
  // A collection lives in its own table: deleting it writes one deletions row for it and no row for its items, which
  // show ungrouped until it is restored (§delete.collection).
  "item.delete": async (i: Ref, _c, x) => {
    const repo = docsRepo(x.db, { clock: x.clock });
    const inDocs = await x.db
      .prepare("SELECT 1 AS n FROM docs WHERE id = ? LIMIT 1")
      .bind(i.id)
      .all<{ n: number }>();
    if (!inDocs.results.length) {
      const t = tablesRepo(x.db, { clock: x.clock });
      const coll = await t.collectionRows.get(i.id);
      if (coll) {
        await t.deletions.markCollection(i.id);
        await t.collectionRows.remove(i.id, coll.v);
        return { deleted: true, collection: i.id };
      }
    }
    const c = await collectionOf(x.db, i.id);
    // A note is a row: it is hidden there and listed in Recently deleted (§delete.soft).
    if (c === "notes") {
      const gone = await tablesRepo(x.db, {
        clock: x.clock,
      }).deletions.markNote(i.id);
      if (gone) return { deleted: true };
    }
    return { deleted: await repo.markDeleted(c, i.id) };
  },
  // A restore only clears the deletions row: the document was never removed (§delete.soft).
  "item.restore": async (i: Ref, _c, x) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    // A set item is a row of set_items, listed by its item id (or by an older `<set>/<item>` key).
    const itemId = itemKey(i.id.slice(i.id.indexOf("/") + 1));
    const item = await t.setBook.getItem(itemId, { deleted: true });
    if (item) {
      if (item.deleted_at != null) {
        const r = await t.setBook.restoreItem(item.id, item.v);
        if (!r.ok) throw new CommandError(409, "that item changed; try again");
      }
      if (
        !(await t.deletions.restoreSetItem(item.id)) &&
        item.deleted_at == null
      )
        throw new CommandError(404, `${i.id} is not in Recently deleted`);
      return { restored: 1 };
    }
    // A collection lives in its own table; any other item is named by the collection its document is in.
    const coll = await t.collectionRows.get(i.id, { deleted: true });
    const c = coll ? "collections" : await collectionOf(x.db, i.id);
    const restored = await t.deletions.restore(c, i.id);
    if (coll?.deleted_at != null) await t.collectionRows.restore(i.id, coll.v);
    if (!restored)
      throw new CommandError(404, `${i.id} is not in Recently deleted`);
    return { restored };
  },
  "item.rename": async (i: Ref & { title: string }, _c, x) => {
    // A collection lives in its own table: rename it there (nothing else changes).
    const t = tablesRepo(x.db, { clock: x.clock });
    const coll = await t.collectionRows.get(i.id);
    if (coll) {
      const r = await t.collectionRows.save(
        {
          id: coll.id,
          title: i.title,
          parent_id: coll.parent_id,
          pos: coll.pos,
        },
        coll.v,
      );
      if (!r.ok)
        throw new CommandError(409, "that collection changed; try again");
      return { version: r.row.v };
    }
    const repo = docsRepo(x.db, { clock: x.clock });
    const c = await placeOf(x, i.id);
    // A set or a date on its table is renamed there; E.V.'s sets that are still documents go on to the document below.
    const setRow = c === "sets" ? await t.sets.get(i.id) : null;
    if (setRow) {
      const { at: _a, v: _v, deleted_at: _d, ...f } = setRow;
      const r = await t.sets.save({ ...f, title: i.title }, setRow.v);
      if (!r.ok) throw new CommandError(409, "that item changed; try again");
      return { version: r.row.v };
    }
    const goalRow = c === "exams" ? await t.goals.get(i.id) : null;
    if (goalRow) {
      const { at: _a, v: _v, deleted_at: _d, ...f } = goalRow;
      const r = await t.goals.save({ ...f, title: i.title }, goalRow.v);
      if (!r.ok) throw new CommandError(409, "that item changed; try again");
      return { version: r.row.v };
    }
    if (c === "notes") {
      const note = await t.noteBook.get(noteRowId(i.id));
      if (note) {
        if (!i.title.trim() || i.title.length > NOTE_MAX.title)
          throw new CommandError(400, "a note title is 1 to 300 characters");
        const { at: _a, v: _v, deleted_at: _d, ...f } = note;
        const r = await t.noteBook.change({ ...f, title: i.title }, note.v);
        if (!r.ok) throw new CommandError(409, "that item changed; try again");
        return { version: r.row.v };
      }
    }
    const doc = await repo.get(c, i.id);
    if (!doc) throw new CommandError(404, `no item ${i.id}`);
    const r = await repo.rename(c, i.id, i.title, doc.v);
    if (!r.ok)
      throw r.status === 409
        ? new CommandError(409, "that item changed; try again")
        : new CommandError(400, r.error);
    return { version: r.version };
  },
  "collection.create": async (i: { title: string }, _c, x) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    const pos = (await t.collectionRows.list()).reduce(
      (m, c) => Math.max(m, c.pos + 1),
      0,
    );
    const r = await t.collectionRows.save(
      { id: colKey(x.newId()), title: i.title, parent_id: null, pos },
      null,
    );
    if (!r.ok) throw new CommandError(409, "that collection already exists");
    return { collection: r.row };
  },
};
