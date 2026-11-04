// What the Matt-command handler files share: event keys in ev4's form, a read-change-save on one document pinned to the
// version read (a stale write is a 409, §data.protocol), and an append to today's talk document. Nothing here removes
// anything (§delete.soft).
import { centralDate } from "../domain/index.ts";
import { docsRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { HandlerCtx } from "./handlers-core.ts";

export type Doc = Record<string, any>;

export const iso = (ms: number) => new Date(ms).toISOString();

const pad = (n: number) => String(n).padStart(2, "0");
const letters = (r: string, keep: RegExp) => r.toLowerCase().replace(keep, "");

/** `<prefix>-YYYYMMDD-HHMMSS-<rand>`, the key form ev4's events maps require. */
export function eventKey(ms: number, rand: string, prefix = "page"): string {
  const d = new Date(ms);
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `${prefix}-${stamp}-${letters(rand, /[^a-z0-9]/g) || "x"}`;
}

/** A short random part for a key, taken from the context's id source. */
export const rand = (x: Pick<HandlerCtx, "newId">) =>
  x.newId().replace(/-/g, "").slice(0, 6);

export async function need(
  x: HandlerCtx,
  c: string,
  id: string,
): Promise<{ data: Doc; v: number }> {
  const doc = await docsRepo(x.db, { clock: x.clock }).get(c, id);
  if (!doc || typeof doc.data !== "object" || doc.data === null)
    throw new CommandError(404, `no ${c} entry ${id}`);
  return { data: doc.data as Doc, v: doc.v };
}

/** Saves `doc` at `v` (null: a new document); a refusal by the protocol or a stale version is a 409/400. */
export async function put(
  x: HandlerCtx,
  c: string,
  id: string,
  doc: Doc,
  v: number | null,
): Promise<number> {
  const r = await docsRepo(x.db, { clock: x.clock }).save(
    c,
    id,
    JSON.stringify(doc),
    v,
  );
  if (!r.ok) throw new CommandError(409, "that changed; try again");
  return r.version;
}

/** Reads a document, applies `change` to a copy and saves it with the version read. */
export async function edit(
  x: HandlerCtx,
  c: string,
  id: string,
  change: (d: Doc) => void,
): Promise<number> {
  const cur = await need(x, c, id);
  const doc: Doc = { ...cur.data };
  change(doc);
  return put(x, c, id, doc, cur.v);
}

/** Adds one event to a document's `events` map (append-only for the page). */
export const addEvent = (
  x: HandlerCtx,
  c: string,
  id: string,
  event: Doc,
  extra: (d: Doc) => void = () => {},
) =>
  edit(x, c, id, (d) => {
    const at = iso(x.clock());
    d.events = {
      ...d.events,
      [eventKey(x.clock(), rand(x))]: { at, ...event },
    };
    extra(d);
  });

/** Appends Matt's line to today's talk document (ev4 talk schema 4). */
export async function talkLine(
  x: HandlerCtx,
  line: Doc,
  source: string,
): Promise<string> {
  const now = x.clock();
  const date = centralDate(now);
  const docs = docsRepo(x.db, { clock: x.clock });
  const cur = await docs.get("talk", date);
  const base: Doc = cur
    ? { ...(cur.data as Doc) }
    : { schema: 4, writer: "page", at: iso(now), source, date, messages: {} };
  // talk keys end in letters only: the digits of the random part become g..p
  const tail = rand(x).replace(
    /[0-9]/g,
    (d) => "ghijklmnop"[Number(d)] as string,
  );
  const key = eventKey(now, `page${tail}`, "m");
  base.messages = {
    ...base.messages,
    [key]: { role: "matt", at: iso(now), ...line },
  };
  await put(x, "talk", date, base, cur ? cur.v : null);
  return key;
}
