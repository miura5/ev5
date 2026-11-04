// The instant commands' handlers (CONTRACT §cmd.registry): each runs for a caller the route already checked.
// Table-backed commands use the repositories; commands a screen carries out itself (open, theme, navigation) are
// acknowledged here so the route never answers 501 for them. Nothing here removes a document (§delete.who).
import { docsRepo, tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import type { Caller } from "../commands/index.ts";

/** A refusal with its HTTP status, raised by a handler and turned into JSON by the route. */
export class CommandError extends Error {
  readonly status: 400 | 404 | 409 | 429 | 502 | 503;
  constructor(status: 400 | 404 | 409 | 429 | 502 | 503, message: string) {
    super(message);
    this.status = status;
  }
}

export interface HandlerCtx {
  db: DocsD1;
  clock: () => number;
  newId: () => string;
  /** Asks E.V. one question on the same path as POST /ask; the route supplies it from the Worker's bindings. */
  ask?: (text: string) => Promise<unknown>;
}
export type CommandHandler = (
  input: never,
  caller: Caller,
  ctx: HandlerCtx,
) => Promise<unknown>;

type Ref = { id: string };

/** The collection a document id lives in; an id used in two collections must be named by the caller. */
async function collectionOf(db: DocsD1, id: string): Promise<string> {
  const { results } = await db
    .prepare("SELECT DISTINCT c FROM docs WHERE id = ? LIMIT 2")
    .bind(id)
    .all<{ c: string }>();
  if (!results.length) throw new CommandError(404, `no item ${id}`);
  if (results.length > 1)
    throw new CommandError(409, `${id} is in two collections`);
  return (results[0] as { c: string }).c;
}

const ack = async () => ({ client: true });

export const commandHandlers: Record<string, CommandHandler> = {
  // A chat turn (effect 'chat'): the same code path as POST /api/v1/ask, so spend, ceilings and citations are shared.
  'ask.send': async (i: { text: string }, _caller, ctx) => {
    if (!ctx.ask) throw new CommandError(503, 'asking is not available here');
    return ctx.ask(i.text);
  },
  // Carried out by the screen; the server only agrees.
  "item.open": ack,
  "palette.open": ack,
  "palette.to_ev": ack,
  "theme.toggle": ack,
  "nav.go": ack,

  "item.pin": async (i: Ref, _c, x) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    const c = await collectionOf(x.db, i.id);
    const pins = await t.pins.list();
    const own = pins.find((p) => p.targetC === c && p.targetId === i.id);
    const pos = own
      ? own.pos
      : pins.reduce((m, p) => Math.max(m, p.pos + 1), 0);
    return { pin: await t.pins.set(c, i.id, pos) };
  },
  "item.unpin": async (i: Ref, _c, x) => ({
    removed: await tablesRepo(x.db, { clock: x.clock }).pins.remove(
      await collectionOf(x.db, i.id),
      i.id,
    ),
  }),
  "item.move": async (i: Ref & { collection: string }, _c, x) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    const c = await collectionOf(x.db, i.id);
    if (!(await t.collections.get(i.collection)))
      throw new CommandError(404, `no collection ${i.collection}`);
    const cur = await t.memberships.get(c, i.id);
    const r = await t.memberships.save(
      { itemC: c, itemId: i.id, collectionId: i.collection },
      cur ? cur.v : null,
    );
    if (!r.ok) throw new CommandError(409, "that item changed; try again");
    return { membership: r.row };
  },
  "item.delete": async (i: Ref, _c, x) => {
    const repo = docsRepo(x.db, { clock: x.clock });
    return {
      deleted: await repo.markDeleted(await collectionOf(x.db, i.id), i.id),
    };
  },
  // A restore only clears the deletions row: the document was never removed (§delete.soft).
  "item.restore": async (i: Ref, _c, x) => {
    const r = await x.db
      .prepare("DELETE FROM deletions WHERE id = ?")
      .bind(i.id)
      .run();
    if (!r.meta.changes)
      throw new CommandError(404, `${i.id} is not in Recently deleted`);
    return { restored: r.meta.changes };
  },
  "item.rename": async (i: Ref & { title: string }, _c, x) => {
    const repo = docsRepo(x.db, { clock: x.clock });
    const c = await collectionOf(x.db, i.id);
    const doc = await repo.get(c, i.id);
    if (
      !doc ||
      typeof doc.data !== "object" ||
      doc.data === null ||
      Array.isArray(doc.data)
    )
      throw new CommandError(404, `no item ${i.id}`);
    const r = await repo.save(
      c,
      i.id,
      JSON.stringify({ ...doc.data, title: i.title }),
      doc.v,
    );
    if (!r.ok) throw new CommandError(409, "that item changed; try again");
    return { version: r.version };
  },
  "collection.create": async (i: { title: string }, _c, x) => {
    const t = tablesRepo(x.db, { clock: x.clock });
    const pos = (await t.collections.list()).reduce(
      (m, c) => Math.max(m, c.pos + 1),
      0,
    );
    const r = await t.collections.save(
      { id: x.newId(), title: i.title, parentId: null, pos },
      null,
    );
    if (!r.ok) throw new CommandError(409, "that collection already exists");
    return { collection: r.row };
  },
};
