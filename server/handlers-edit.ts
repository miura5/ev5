// What the Matt-command handler files share: event keys in ev4's form, a save pinned to the version read (a stale write is
// a 409, §data.protocol), and an append of a talk row. Nothing here removes
// anything (§delete.soft).
import { docsRepo, tablesRepo } from "../data/index.ts";
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

/** Appends the user's line as one talk row (§data.append-only); a session check-in names its session, an Ask line its chat. */
export async function talkLine(
  x: HandlerCtx,
  line: { text: string; chatId?: string; sessionId?: string; replyTo?: string },
): Promise<string> {
  const book = tablesRepo(x.db, { clock: x.clock }).talkBook;
  const id = `talk_${x.newId()}`;
  const chatId = line.sessionId
    ? line.sessionId
    : (line.chatId ??
      (await book.line(line.replyTo ?? ""))?.chat_id ??
      (await book.latestAskChat()) ??
      `chat_${x.newId()}`);
  await book.say({
    id,
    chat_id: chatId,
    scope: line.sessionId ? "session" : "ask",
    session_id: line.sessionId ?? null,
    context_kind: null,
    context_id: null,
    role: "user",
    text: line.text,
    cites: null,
    job_id: null,
  });
  return id;
}
