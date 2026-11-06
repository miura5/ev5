// What the Matt-command handler files share: event keys in ev4's form, a save pinned to the version read (a stale write is
// a 409, §data.protocol), and an append to today's talk document. Nothing here removes
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
