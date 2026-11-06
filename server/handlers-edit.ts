// What the Matt-command handler files share: event keys in ev4's form, and the appends of an attempt and a talk row. Nothing here removes
// anything (§delete.soft).
import { tablesRepo } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { HandlerCtx } from "./handlers-core.ts";

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

/** Appends the user's line as one talk row (§data.append-only); a session check-in names its session, an Ask line its chat. */
/** Appends one log-only attempts row through the gate (§data.gate); a retry that names the same id is a 409, never a second row. */
export async function logAttempt(
  x: HandlerCtx,
  a: {
    id?: string;
    item_id: string;
    set_id: string;
    session_id: string | null;
    source: "note" | "ask";
    how: "typed" | "told";
    answer: unknown;
  },
): Promise<string> {
  const id = a.id ?? `att_${x.newId().replace(/-/g, "")}`;
  const r = await tablesRepo(x.db, { clock: x.clock }).attempts.recordLogOnly({
    ...a,
    id,
    answer: a.answer as never,
    answered_at: x.clock(),
  });
  if (!r.ok) throw new CommandError(409, "that attempt was already recorded");
  return id;
}

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
