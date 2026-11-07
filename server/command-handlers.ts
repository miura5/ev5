// The instant commands' handlers (CONTRACT §cmd.registry): each runs for a caller the route already checked.
// Table-backed commands use the repositories; commands a screen carries out itself (open, theme, navigation) are
// acknowledged here so the route never answers 501 for them. Nothing here removes a document (§delete.who).
import { tablesRepo } from "../data/index.ts";
import { NOTE_MAX, itemKey } from "../domain/index.ts";
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

type Tables = ReturnType<typeof tablesRepo>;

/** The collection name an item is pinned, moved, renamed and deleted under, read from its row (§data.tables). A set or
 * a goal is named by its id prefix: `set_` is "sets" and `goal_` is "goals". A note is
 * found by its row id and a session by its own. No document is read. */
async function collectionOf(
  t: Tables,
  id: string,
  o: { deleted?: boolean } = {},
): Promise<string> {
  if (id.startsWith("set_") && (await t.sets.get(id, o))) return "sets";
  if (id.startsWith("goal_") && (await t.goals.get(id, o))) return "goals";
  if (await t.noteBook.get(id, o)) return "notes";
  if (await t.sessionBook.get(id, o)) return "sessions";
  throw new CommandError(404, `no item ${id}`);
}

async function placeOf(x: HandlerCtx, id: string): Promise<string> {
  return collectionOf(tablesRepo(x.db, { clock: x.clock }), id);
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
  "item.move": async (
    i: Ref & { collection: string; if_version?: number },
    _c,
    x,
  ) => {
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
        i.if_version ?? setRow.v,
      );
      if (!m.ok) throw new CommandError(409, "that item changed; try again");
      return { set: { id: i.id, collectionId: i.collection } };
    }
    if (c === "notes") {
      // A note keeps its collection on its own row; GET /memberships reads it from there.
      const note = await t.noteBook.get(i.id);
      if (!note) throw new CommandError(404, `no item ${i.id}`);
      const { at: _a, v: _v, deleted_at: _d, ...f } = note;
      const m = await t.noteBook.change(
        { ...f, collection_id: i.collection },
        i.if_version ?? note.v,
      );
      if (!m.ok) throw new CommandError(409, "that item changed; try again");
      return { note: { id: i.id, collectionId: i.collection } };
    }
    const cur = await t.memberships.get(c, i.id);
    // 0 names an item with no membership yet (as in note.save); anything else must be the version read.
    if (i.if_version !== undefined && i.if_version !== (cur?.v ?? 0))
      throw new CommandError(409, "that item changed; try again");
    const r = await t.memberships.save(
      { itemC: c, itemId: i.id, collectionId: i.collection },
      cur ? (i.if_version ?? cur.v) : null,
    );
    if (!r.ok) throw new CommandError(409, "that item changed; try again");
    return { membership: r.row };
  },
  // A collection lives in its own table: deleting it sets its `deleted_at` (one statement) and touches no row of its
  // items, which show ungrouped until it is restored (§delete.collection).
  "item.delete": async (i: Ref, _c, x) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    if (i.id.startsWith("col_")) {
      const coll = await t.collectionRows.get(i.id);
      if (coll) {
        const r = await t.collectionRows.remove(i.id, coll.v);
        if (!r.ok) throw new CommandError(409, "that item changed; try again");
        return { deleted: true, collection: i.id };
      }
    }
    const c = await collectionOf(t, i.id);
    // A note is a row: it is hidden there and listed in Recently deleted (§delete.soft).
    if (c === "notes") return { deleted: await t.deletions.markNote(i.id) };
    // A set or a goal is a row too: hidden there and listed in Recently deleted (§delete.soft).
    if (c === "sets") return { deleted: await t.deletions.markSet(i.id) };
    if (c === "goals") return { deleted: await t.deletions.markGoal(i.id) };
    // A session is a row too: hidden there and listed in Recently deleted (§delete.soft).
    return { deleted: await t.deletions.markSession(i.id) };
  },
  // A restore clears `deleted_at`: the row was never removed (§delete.soft).
  "item.restore": async (i: Ref, _c, x) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    // A set item is a row of set_items, listed by its item id (or by an older `<set>/<item>` key).
    const itemId = itemKey(i.id.slice(i.id.indexOf("/") + 1));
    const item = await t.setBook.getItem(itemId, { deleted: true });
    if (item) {
      if (item.deleted_at == null)
        throw new CommandError(404, `${i.id} is not in Recently deleted`);
      const r = await t.setBook.restoreItem(item.id, item.v);
      if (!r.ok) throw new CommandError(409, "that item changed; try again");
      return { restored: 1 };
    }
    // A collection lives in its own table; any other item is named by the collection its document is in.
    const coll = await t.collectionRows.get(i.id, { deleted: true });
    if (coll) {
      if (coll.deleted_at == null)
        throw new CommandError(404, `${i.id} is not in Recently deleted`);
      const r = await t.collectionRows.restore(i.id, coll.v);
      if (!r.ok) throw new CommandError(409, "that item changed; try again");
      return { restored: 1 };
    }
    const restored = await t.deletions.restore(
      await collectionOf(t, i.id, { deleted: true }),
      i.id,
    );
    if (!restored)
      throw new CommandError(404, `${i.id} is not in Recently deleted`);
    return { restored };
  },
  "item.rename": async (
    i: Ref & { title: string; if_version?: number },
    _c,
    x,
  ) => {
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
        i.if_version ?? coll.v,
      );
      if (!r.ok)
        throw new CommandError(409, "that collection changed; try again");
      return { version: r.row.v };
    }
    const c = await collectionOf(t, i.id);
    // A set or a goal is renamed on its own row.
    const setRow = c === "sets" ? await t.sets.get(i.id) : null;
    if (setRow) {
      const { at: _a, v: _v, deleted_at: _d, ...f } = setRow;
      const r = await t.sets.save(
        { ...f, title: i.title },
        i.if_version ?? setRow.v,
      );
      if (!r.ok) throw new CommandError(409, "that item changed; try again");
      return { version: r.row.v };
    }
    const goalRow = c === "goals" ? await t.goals.get(i.id) : null;
    if (goalRow) {
      const { at: _a, v: _v, deleted_at: _d, ...f } = goalRow;
      const r = await t.goals.save(
        { ...f, title: i.title },
        i.if_version ?? goalRow.v,
      );
      if (!r.ok) throw new CommandError(409, "that item changed; try again");
      return { version: r.row.v };
    }
    if (c === "notes") {
      const note = await t.noteBook.get(i.id);
      if (note) {
        if (!i.title.trim() || i.title.length > NOTE_MAX.title)
          throw new CommandError(400, "a note title is 1 to 300 characters");
        const { at: _a, v: _v, deleted_at: _d, ...f } = note;
        const r = await t.noteBook.change(
          { ...f, title: i.title },
          i.if_version ?? note.v,
        );
        if (!r.ok) throw new CommandError(409, "that item changed; try again");
        return { version: r.row.v };
      }
    }
    throw new CommandError(404, `no item ${i.id} to rename`);
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
