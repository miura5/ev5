// Matt's own sets (CONTRACT §data.tables, §ui.own-everything): `sets` rows with their items in `set_items`,
// written with the table protocol (a version, a stale write is a 409). An item is typed as a question, then "- " lines
// for options and "* " for the right ones. Removing an item writes a `deletions` row and leaves the row (§delete.soft).
import { itemKey, setKey, upgradeItem } from "../domain/index.ts";
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
    type: correct.length > 1 ? "multi_select" : "single",
    options,
    correct,
  };
}

/** An edit changes the typed fields only: rationale, objective, sourceRef, grid and the like stay. */
function edited(
  old: unknown,
  typed: ReturnType<typeof itemBody>,
): Record<string, unknown> {
  const was = upgradeItem(old ?? {}) as Record<string, unknown>;
  const kept: Record<string, unknown> = { ...was, ...typed };
  // per-option rationales only stay while the options they explain are the same count
  if (
    Array.isArray(was.rationales) &&
    was.rationales.length !== typed.options.length
  )
    delete kept.rationales;
  // a table (or other non-choice) item keeps its type; only choice items switch between single and multi_select
  if (was.type && was.type !== "single" && was.type !== "multi_select")
    kept.type = was.type;
  return kept;
}

type Book = NonNullable<
  Awaited<ReturnType<ReturnType<typeof repo>["setBook"]["read"]>>
>;
type TItem = Book["items"][number];
const stamp = (at: number) => new Date(at).toISOString();

/** The set as screens have always had it: its type is "question" and a source is <kind>/<id>. */
const asSet = (s: Book["set"]) => ({
  id: s.id,
  title: s.title ?? "",
  type: "question",
  sourceC: s.source_kind,
  sourceId: s.source_id,
  at: stamp(s.at),
  v: s.v,
});

/** The item as screens have always had it: its body carries its id. */
const asItem = (i: TItem) => ({
  setId: i.set_id,
  itemId: i.id,
  pos: i.pos,
  body: { ...(upgradeItem(i.body) as object), id: i.id },
  at: stamp(i.at),
  v: i.v,
});

/** The row's fields from a typed body: the id is the row's, so the body stays without it. */
function rowBody(body: Record<string, unknown>) {
  const { id: _id, ...rest } = body;
  return {
    type: String(rest.type ?? "single") as TItem["type"],
    body: rest as TItem["body"],
  };
}

async function ownSet(x: HandlerCtx, id: string) {
  const book = await repo(x).setBook.read(setKey(id));
  if (!book) throw new CommandError(404, `no set ${id}`);
  return book;
}

async function ownItem(x: HandlerCtx, set: string, item: string) {
  const book = await ownSet(x, set);
  const found = book.items.find((r) => r.id === itemKey(item));
  if (!found) throw new CommandError(404, `no item ${item} in ${set}`);
  return found;
}

const refuse = () => new CommandError(409, "that set changed; try again");

/** The fields every own set row has besides what the caller changes. */
const ownFields = (
  id: string,
  title: string,
  collection: string | null,
  source: [string | null, string | null],
) => ({
  id,
  collection_id: collection,
  kind: "adhoc" as const,
  title,
  source_kind: source[0],
  source_id: source[1],
  created_by: "user" as const,
  job_id: null,
  focus: null,
  asked: null,
});

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
    const r = await repo(x).setBook.create(
      ownFields(setKey(x.newId()), i.title, i.collection ?? null, [null, null]),
    );
    if (!r.ok) throw refuse();
    if (i.collection) await place(x, "sets", r.row.id, i.collection);
    return { set: asSet(r.row) };
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
    const cur = (await ownSet(x, i.id)).set;
    if (i.type && i.type !== "question")
      throw new CommandError(
        400,
        `${i.type} sets come later; a set is questions for now`,
      );
    const [sourceC, sourceId] =
      i.source === undefined
        ? [cur.source_kind, cur.source_id]
        : i.source.split("/", 2);
    if (i.source !== undefined && (!sourceC || !sourceId))
      throw new CommandError(400, "a source is <collection>/<id>");
    if (i.collection && !(await repo(x).collections.get(i.collection)))
      throw new CommandError(404, `no collection ${i.collection}`);
    const r = await repo(x).setBook.update(
      {
        ...ownFields(
          cur.id,
          i.title ?? cur.title ?? "",
          i.collection ?? cur.collection_id,
          [sourceC ?? null, sourceId ?? null],
        ),
        kind: cur.kind,
        created_by: cur.created_by,
        job_id: cur.job_id,
        focus: cur.focus,
        asked: cur.asked,
      },
      cur.v,
    );
    if (!r.ok) throw refuse();
    if (i.collection) await place(x, "sets", cur.id, i.collection);
    return { set: asSet(r.row) };
  },

  "set.item_add": async (i: { set: string; text: string }, _c, x) => {
    const { set, items } = await ownSet(x, i.set);
    const id = itemKey(x.newId());
    const pos = items.reduce((m, r) => Math.max(m, r.pos + 1), 1);
    const r = await repo(x).setBook.addItem({
      id,
      set_id: set.id,
      pos,
      ...rowBody(itemBody(id, i.text)),
      objective_id: null,
      weak_spot_id: null,
      source_ref: null,
    });
    if (!r.ok) throw refuse();
    return { item: asItem(r.row) };
  },

  "set.item_update": async (
    i: { set: string; item: string; text: string },
    _c,
    x,
  ) => {
    const cur = await ownItem(x, i.set, i.item);
    const r = await repo(x).setBook.editItem(
      cur.id,
      rowBody(edited(cur.body, itemBody(cur.id, i.text))),
      cur.v,
    );
    if (!r.ok) throw refuse();
    return { item: asItem(r.row) };
  },

  "set.item_delete": async (i: { set: string; item: string }, _c, x) => {
    const cur = await ownItem(x, i.set, i.item);
    const r = await repo(x).setBook.removeItem(cur.id, cur.v);
    if (!r.ok) throw refuse();
    // Recently deleted lists the deletion by its `<set>/<item>` key and clears it on a restore.
    await repo(x).deletions.markOwnSetItem(cur.set_id, cur.id);
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
  const row = await repo(x).drafts.pendingIn(i.item, i.set, "set-item");
  if (!row)
    throw new CommandError(404, `no unverified item ${i.item} in ${i.set}`);
  return (draftHandlers[name] as CommandHandler)({ id: i.item } as never, c, x);
}
