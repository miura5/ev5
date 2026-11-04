// Matt's own sets (CONTRACT §data.new-tables, §ui.own-everything): `own_sets` rows with their items in `own_set_items`,
// written with the table protocol (a version, a stale write is a 409). An item is typed as a question, then "- " lines
// for options and "* " for the right ones. Removing an item writes a `deletions` row and leaves the row (§delete.soft).
import { tablesRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { place } from "./handlers-notes.ts";
import { draftHandlers } from "./handlers-drafts.ts";

const repo = (x: HandlerCtx) => tablesRepo(x.db, { clock: x.clock });

/** "Question\n- wrong\n* right" as an ev4 set item; a body that cannot be a question is a 400 saying what is missing. */
function itemBody(id: string, text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const stem = (lines[0] ?? "").replace(/^[-*]\s+/, "");
  const picks = lines.slice(1).filter((l) => /^[-*]\s+\S/.test(l));
  const options = picks.map((l) => l.slice(2).trim());
  const correct = picks.flatMap((l, n) => (l.startsWith("*") ? [n] : []));
  if (!stem || options.length < 2 || !correct.length)
    throw new CommandError(
      400,
      "an item is a question, then at least two options on lines starting with -, and * on the right ones",
    );
  return {
    id,
    stem,
    type: correct.length > 1 ? "sata" : "single",
    options,
    correct,
  };
}

async function ownSet(x: HandlerCtx, id: string) {
  const s = await repo(x).ownSets.get(id);
  if (!s) throw new CommandError(404, `no set ${id}`);
  return s;
}

async function ownItem(x: HandlerCtx, set: string, item: string) {
  await ownSet(x, set);
  const found = (await repo(x).ownSets.items(set)).find(
    (r) => r.itemId === item,
  );
  if (!found) throw new CommandError(404, `no item ${item} in ${set}`);
  return found;
}

const refuse = () => new CommandError(409, "that set changed; try again");

export const setHandlers: Record<string, CommandHandler> = {
  "set.create": async (
    i: { title: string; type?: string; collection?: string },
    _c,
    x,
  ) => {
    if (i.type && i.type !== "question")
      throw new CommandError(
        400,
        `${i.type} sets come later; a set is questions for now`,
      );
    if (i.collection && !(await repo(x).collections.get(i.collection)))
      throw new CommandError(404, `no collection ${i.collection}`);
    const r = await repo(x).ownSets.save(
      {
        id: x.newId(),
        title: i.title,
        type: "question",
        sourceC: null,
        sourceId: null,
      },
      null,
    );
    if (!r.ok) throw refuse();
    if (i.collection) await place(x, "own_sets", r.row.id, i.collection);
    return { set: r.row };
  },

  "set.update": async (
    i: {
      id: string;
      title?: string;
      type?: string;
      collection?: string;
      source?: string;
    },
    _c,
    x,
  ) => {
    const cur = await ownSet(x, i.id);
    if (i.type && i.type !== "question")
      throw new CommandError(
        400,
        `${i.type} sets come later; a set is questions for now`,
      );
    const [sourceC, sourceId] =
      i.source === undefined
        ? [cur.sourceC, cur.sourceId]
        : i.source.split("/", 2);
    if (i.source !== undefined && (!sourceC || !sourceId))
      throw new CommandError(400, "a source is <collection>/<id>");
    const r = await repo(x).ownSets.save(
      {
        id: cur.id,
        title: i.title ?? cur.title,
        type: "question",
        sourceC: sourceC ?? null,
        sourceId: sourceId ?? null,
      },
      cur.v,
    );
    if (!r.ok) throw refuse();
    if (i.collection) await place(x, "own_sets", cur.id, i.collection);
    return { set: r.row };
  },

  "set.item_add": async (i: { set: string; text: string }, _c, x) => {
    await ownSet(x, i.set);
    const items = await repo(x).ownSets.items(i.set);
    const id = x.newId();
    const pos = items.reduce((m, r) => Math.max(m, r.pos + 1), 1);
    const r = await repo(x).ownSets.saveItem(
      { setId: i.set, itemId: id, pos, body: itemBody(id, i.text) as never },
      null,
    );
    if (!r.ok) throw refuse();
    return { item: r.row };
  },

  "set.item_update": async (
    i: { set: string; item: string; text: string },
    _c,
    x,
  ) => {
    const cur = await ownItem(x, i.set, i.item);
    const r = await repo(x).ownSets.saveItem(
      {
        setId: i.set,
        itemId: i.item,
        pos: cur.pos,
        body: itemBody(i.item, i.text) as never,
      },
      cur.v,
    );
    if (!r.ok) throw refuse();
    return { item: r.row };
  },

  "set.item_delete": async (i: { set: string; item: string }, _c, x) => {
    await ownItem(x, i.set, i.item);
    await x.db
      .prepare(
        "INSERT INTO deletions (c, id, at) VALUES ('own_set_items', ?, ?) ON CONFLICT (c, id) DO UPDATE SET at = excluded.at",
      )
      .bind(`${i.set}/${i.item}`, x.clock())
      .run();
    return { set: i.set, item: i.item, deleted: true };
  },

  // The screen leaves its editor; the server agrees once the set exists.
  "set.done": async (i: { id: string }, _c, x) => {
    await ownSet(x, i.id);
    return { client: true, id: i.id };
  },
  "set.save": async (i: { id: string }, _c, x) => {
    await ownSet(x, i.id);
    return { client: true, id: i.id };
  },

  // An unverified item is a pending set-item draft whose id is the item's id; keeping copies it into the set.
  "set.unverified_keep": (i: { set: string; item: string }, c, x) =>
    unverified("draft.keep", i, c, x),
  "set.unverified_drop": (i: { set: string; item: string }, c, x) =>
    unverified("draft.drop", i, c, x),
};

async function unverified(
  name: "draft.keep" | "draft.drop",
  i: { set: string; item: string },
  c: Parameters<CommandHandler>[1],
  x: HandlerCtx,
) {
  const row = await x.db
    .prepare(
      "SELECT id FROM drafts WHERE id = ? AND target_id = ? AND kind = 'set-item' AND state = 'pending'",
    )
    .bind(i.item, i.set)
    .first<{ id: string }>();
  if (!row)
    throw new CommandError(404, `no unverified item ${i.item} in ${i.set}`);
  return (draftHandlers[name] as CommandHandler)({ id: i.item } as never, c, x);
}
