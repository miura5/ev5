// Study sessions and their checks (CONTRACT §cmd.registry, §data.protocol): a session is an ev4 `sessions` document, its
// clock rebuilt from the events map, so every command here appends one event (or the marks status and endedAt) at the
// version read. Starting one ends the one running (a mark, never a removal). A check's answer is Matt's line in today's
// talk document; the session keeps only that it was answered (the note's text never enters a session).
import { sessionState } from "../domain/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import {
  addEvent,
  eventKey,
  iso,
  need,
  put,
  rand,
  talkLine,
} from "./handlers-edit.ts";
import type { Doc } from "./handlers-edit.ts";

const SESSION_ID = /^ss-/;
const view = (id: string, d: Doc) => ({ ...d, id }) as never;

async function open(
  x: HandlerCtx,
  id: string,
): Promise<{ data: Doc; v: number }> {
  const cur = await need(x, "sessions", id);
  if (!["active", "ending"].includes(cur.data.status))
    throw new CommandError(409, `session ${id} is not running`);
  return cur;
}

/** Marks every running session ended (why: switched) except `keep`; a new session starts after it, so one runs at a time. */
async function endRunning(x: HandlerCtx, keep: string) {
  const { results } = await x.db
    .prepare(
      `SELECT id FROM docs WHERE c = 'sessions' AND id != ? AND (data LIKE '%"status":"active"%' OR data LIKE '%"status":"ending"%')`,
    )
    .bind(keep)
    .all<{ id: string }>();
  for (const { id } of results)
    await addEvent(x, "sessions", id, { type: "end", why: "switched" }, (d) => {
      d.status = "ended";
      d.endedAt = iso(x.clock());
    });
}

export const sessionHandlers: Record<string, CommandHandler> = {
  "session.start": async (i: { plan?: string }, _c, x) => {
    const now = x.clock();
    const at = iso(now);
    const id = `ss-${x.newId()}`;
    await endRunning(x, id);
    await put(
      x,
      "sessions",
      id,
      {
        schema: 2,
        writer: "page",
        at,
        source: "E.V. Home",
        status: "active",
        kind: "note",
        comments: "some",
        date: at.slice(0, 10),
        startedAt: at,
        planned: 25,
        topic: "Study session",
        noteId: "",
        folder: "",
        events: { [eventKey(now, rand(x))]: { type: "start" } },
      },
      null,
    );
    return { id, ...(i.plan ? { plan: i.plan } : {}) };
  },

  // Pause is a break and the second tap resumes (the clock reads both from the events).
  "session.pause": async (i: { id: string }, _c, x) => {
    const cur = await open(x, i.id);
    const paused = sessionState(view(i.id, cur.data), x.clock()).onBreak;
    await addEvent(x, "sessions", i.id, { type: paused ? "resume" : "break" });
    return { id: i.id, paused: !paused };
  },

  "session.end": async (i: { id: string }, _c, x) => {
    const cur = await open(x, i.id);
    const minutes = sessionState(view(i.id, cur.data), x.clock()).minutes;
    await addEvent(x, "sessions", i.id, { type: "end", why: "ended" }, (d) => {
      d.status = "ended";
      d.endedAt = iso(x.clock());
      d.minutes = minutes;
    });
    return { id: i.id, minutes };
  },

  // The answer is Matt's line in the talk document; the session records that check n was answered.
  "check.answer": async (i: { id: string; answer: string }, _c, x) => {
    const cur = await open(x, i.id);
    const n = Math.max(1, sessionState(view(i.id, cur.data), x.clock()).checks);
    const msg = await talkLine(
      x,
      {
        text: i.answer.slice(0, 4000),
        session: SESSION_ID.test(i.id) ? i.id : undefined,
      },
      "v5/sessions",
    );
    await addEvent(x, "sessions", i.id, { type: "answer", n, msgId: msg });
    return { id: i.id, n };
  },

  // Logged as one answer event with no check number: nothing is marked answered by it.
  "check.just_tell_me": async (i: { id: string }, _c, x) => {
    await open(x, i.id);
    await addEvent(x, "sessions", i.id, { type: "answer", why: "tell-me" });
    return { id: i.id, told: true };
  },
};
