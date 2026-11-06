// Study sessions and their checks (CONTRACT §cmd.registry, §data.protocol): a session is an ev4 `sessions` document, its
// clock rebuilt from the events map, so every command here appends one event (or the marks status and endedAt) at the
// version read. Starting one ends the one running (a mark, never a removal). A check's answer is Matt's line in today's
// talk document; the session keeps only that it was answered (the note's text never enters a session).
import {
  centralDate,
  newSessionEventRow,
  sessionDoc,
  sessionDocId,
  sessionRowId,
  sessionState,
} from "../domain/index.ts";
import type { NewSessionRow, SessionEvent } from "../domain/index.ts";
import { tablesRepo } from "../data/index.ts";
import type { StoredSession } from "../data/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { eventKey, iso, rand, talkLine } from "./handlers-edit.ts";

const SESSION_ID = /^ss-/;
const book = (x: HandlerCtx) =>
  tablesRepo(x.db, { clock: x.clock }).sessionBook;
const view = (s: StoredSession) =>
  ({ ...sessionDoc(s.row, s.events), id: sessionDocId(s.row.id) }) as never;

async function open(x: HandlerCtx, id: string): Promise<StoredSession> {
  const cur = await book(x).get(sessionRowId(id));
  if (!cur) throw new CommandError(404, `no sessions entry ${id}`);
  if (!["active", "ending"].includes(cur.row.status))
    throw new CommandError(409, `session ${id} is not running`);
  return cur;
}

/** Appends one event row to a session. The session row is saved first at the version read (a stale write is a 409, §data.protocol). */
async function addEvent(
  x: HandlerCtx,
  s: StoredSession,
  event: SessionEvent,
  change: Partial<NewSessionRow> = {},
) {
  const { at: _a, v: _v, deleted_at: _d, ...fields } = s.row;
  const saved = await book(x).change({ ...fields, ...change }, s.row.v);
  if (!saved.ok) throw new CommandError(409, "that changed; try again");
  const now = x.clock();
  await book(x).append(
    newSessionEventRow(sessionDocId(s.row.id), eventKey(now, rand(x)), {
      at: iso(now),
      ...event,
    }),
  );
}

/** Marks every running session ended (why: switched) except `keep`; a new session starts after it, so one runs at a time. */
async function endRunning(x: HandlerCtx, keep: string) {
  for (const r of await book(x).running())
    if (r.id !== sessionRowId(keep))
      await addEvent(
        x,
        (await book(x).get(r.id))!,
        { type: "end", why: "switched" },
        { status: "ended", ended_at: x.clock() },
      );
}

export const sessionHandlers: Record<string, CommandHandler> = {
  "session.start": async (i: { plan?: string; noteId?: string }, _c, x) => {
    const now = x.clock();
    const id = `ss-${x.newId()}`;
    await endRunning(x, id);
    const made = await book(x).create({
      id: sessionRowId(id),
      kind: "note",
      note_id: i.noteId || null,
      set_id: null,
      collection_id: null,
      day: centralDate(now),
      status: "active",
      planned_min: 25,
      started_at: now,
      ended_at: null,
      topic: "Study session",
      clock: null,
      minutes: null,
      driver: null,
    });
    if (!made.ok) throw new CommandError(409, "that changed; try again");
    await book(x).append(
      newSessionEventRow(id, eventKey(now, rand(x)), {
        at: iso(now),
        type: "start",
      }),
    );
    return { id, ...(i.plan ? { plan: i.plan } : {}) };
  },

  // Pause is a break and the second tap resumes (the clock reads both from the events).
  "session.pause": async (i: { id: string }, _c, x) => {
    const cur = await open(x, i.id);
    const paused = sessionState(view(cur), x.clock()).onBreak;
    await addEvent(x, cur, { type: paused ? "resume" : "break" });
    return { id: i.id, paused: !paused };
  },

  "session.end": async (i: { id: string }, _c, x) => {
    const cur = await open(x, i.id);
    const minutes = sessionState(view(cur), x.clock()).minutes;
    await addEvent(
      x,
      cur,
      { type: "end", why: "ended" },
      { status: "ended", ended_at: x.clock(), minutes: Math.round(minutes) },
    );
    return { id: i.id, minutes };
  },

  // The answer is Matt's line in the talk document; the session records that check n was answered.
  "check.answer": async (i: { id: string; answer: string }, _c, x) => {
    const cur = await open(x, i.id);
    const n = Math.max(1, sessionState(view(cur), x.clock()).checks);
    const msg = await talkLine(
      x,
      {
        text: i.answer.slice(0, 4000),
        session: SESSION_ID.test(i.id) ? i.id : undefined,
      },
      "v5/sessions",
    );
    await addEvent(x, cur, { type: "answer", n, msgId: msg });
    return { id: i.id, n };
  },

  // Logged as one answer event with no check number: nothing is marked answered by it.
  "check.just_tell_me": async (i: { id: string }, _c, x) => {
    await addEvent(x, await open(x, i.id), { type: "answer", why: "tell-me" });
    return { id: i.id, told: true };
  },
};
