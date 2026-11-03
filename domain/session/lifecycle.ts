import { centralDate } from '../time/index.ts';
import { noteMark } from './note.ts';
import { entryTime, isoOf, toMs } from './stamp.ts';
import type { SessionDoc, SessionEvent, SessionWrite } from './types.ts';

const OPEN = ['active', 'ending'];

export type StartInput = {
  id: string;
  at: string;
  /** The page's event key for `at`. */
  key: string;
  date?: string;
  topic?: string;
  planned?: number;
  noteId?: string;
  /** A new note: it starts at its empty mark, so the first check is on what he writes. */
  fresh?: boolean;
  comments?: string;
  view?: string;
  clock?: string;
};

/**
 * The write that starts a timed session, from Notes (names the note as notes/<id>) or from a Today task (no note). It
 * runs `planned` minutes (25 for a note); a note's session with clock 'writing' has no planned end.
 */
export function startSession(i: StartInput): SessionWrite {
  const writing = i.clock === 'writing' && !!i.noteId;
  const noteId = String(i.noteId ?? '');
  return {
    op: 'set',
    collection: 'sessions',
    id: i.id,
    data: {
      schema: 2,
      writer: 'page',
      at: isoOf(i.at),
      source: 'E.V. Home',
      status: 'active',
      kind: 'note',
      comments: ['more', 'some', 'off'].includes(i.comments ?? '') ? i.comments : 'some',
      date: i.date || centralDate(new Date(i.at)),
      startedAt: i.at,
      ...(writing ? { clock: 'writing' } : { planned: Math.max(1, Math.min(600, Math.round(Number(i.planned) || 25))) }),
      topic: String(i.topic || 'Study session').slice(0, 120),
      noteId,
      ...(noteId ? { note: `notes/${noteId}` } : {}),
      folder: '',
      driver: { view: String(i.view ?? ''), at: i.at },
      events: { [i.key]: i.fresh && noteId ? { type: 'start', noteId, ...noteMark('') } : { type: 'start' } },
    },
  };
}

type Last = [string, SessionEvent] | [];

function lastOf(s: SessionDoc, types: string[]): Last {
  const hits = Object.entries(s.events ?? {})
    .filter(([, e]) => e && types.includes(e.type))
    .sort(([a], [b]) => a.localeCompare(b));
  return hits.at(-1) ?? [];
}

/**
 * Starting a second session ends the running one first. The switch only marks it: status ended, when, and an end event
 * saying why. Its summary and findings are filed once Undo is no longer offered, so an Undo never takes back a
 * write-once field or a finding.
 */
export function switchSession(s: SessionDoc | null, i: { at: string; key: string; view?: string }): SessionWrite[] {
  if (!s || !OPEN.includes(s.status ?? '')) return [];
  const end = { type: 'end', why: 'switched', at: i.at, ...(i.view ? { view: String(i.view) } : {}) };
  return [
    { op: 'update', collection: 'sessions', id: s.id, data: { status: 'ended', endedAt: i.at, events: { [i.key]: end } } },
  ];
}

/** The switch that ended this session, while it waits to be filed: {at, view}; else null. */
function switchedEnd(s: SessionDoc | null): { at: string; view: string | null } | null {
  if (!s || s.status !== 'ended' || s.filedAt || s.kind === 'skill') return null;
  const [k, last] = lastOf(s, ['end', 'reopen']);
  return k && last?.type === 'end' && last.why === 'switched' ? { at: isoOf(entryTime(k, last)), view: last.view ?? null } : null;
}

/** When a switch ended this session (its end event's time), while it waits to be filed; else null. */
export const switchedAt = (s: SessionDoc | null): string | null => switchedEnd(s)?.at ?? null;

/**
 * Undo of a switch, through marks only (nothing is deleted): the session the switch started is marked discarded (with
 * an end event), and the one it ended is active again (a reopen event; its clock, checks and answers pick up where
 * they were). `keys` are two page event keys for `at`, in order. Nothing changes unless the ended session can be
 * reopened: still unfiled, and (given a window) inside it.
 */
export function undoSwitch(
  ended: SessionDoc | null,
  started: SessionDoc | null,
  i: { at: string; keys: [string, string]; windowMs?: number | null }
): SessionWrite[] {
  const since = switchedAt(ended);
  if (!ended || since == null) return [];
  if (i.windowMs != null && toMs(i.at) - toMs(since) >= i.windowMs) return [];
  const out: SessionWrite[] = [];
  if (started && started.status !== 'discarded')
    out.push({
      op: 'update',
      collection: 'sessions',
      id: started.id,
      data: { status: 'discarded', endedAt: i.at, events: { [i.keys[0]]: { type: 'end', why: 'undone', at: i.at } } },
    });
  out.push({
    op: 'update',
    collection: 'sessions',
    id: ended.id,
    // a filing begun before the Undo is void (filingOf also says so by the reopen's time)
    data: { status: 'active', endedAt: null, filing: null, events: { [i.keys[1]]: { type: 'reopen', at: i.at } } },
  });
  return out;
}

/** The filing mark a close honours: one with a time and no reopen after it (an Undo voids it); else null. */
export function filingOf(s: SessionDoc | null): { at: string; wrap: object } | null {
  const m = s?.filing && typeof s.filing === 'object' && s.filing.at ? s.filing : null;
  if (!m || !s) return null;
  const t = toMs(m.at);
  const reopened = Object.entries(s.events ?? {}).some(([k, e]) => e?.type === 'reopen' && toMs(entryTime(k, e)) > t);
  return reopened ? null : m;
}

/** A session left wrapping up (status ending, not filed): its end event {at, why, view}; else null. */
export function endingOf(s: SessionDoc | null): { at: string | null; why: string; view: string | null } | null {
  if (!s || s.status !== 'ending' || s.filedAt || s.kind === 'skill') return null;
  const [k, e] = lastOf(s, ['end']);
  return e && k ? { at: isoOf(entryTime(k, e)), why: e.why ?? 'ended', view: e.view ?? null } : { at: null, why: 'ended', view: null };
}
