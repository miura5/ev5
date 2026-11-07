import { expect, test } from 'vitest';
import {
  endingOf,
  filingOf,
  noteMark,
  sessionState,
  startSession,
  switchSession,
  switchedAt,
  undoSwitch,
  type SessionDoc,
} from './index.ts';
import { apply, base, plus, session, sk, T0 } from './fixtures.ts';

// Ported from ev4 test/sessions.test.mjs: switching sessions, Undo through marks, the filing mark.

test('a second session ends and logs the running one; Undo restores it whole through marks', () => {
  const w0 = startSession({ id: 'ss-new', at: T0, key: sk(T0), topic: 'New note', noteId: 'note_1', fresh: true, comments: 'more', view: 'v1' });
  expect(w0.data.comments).toBe('more');
  expect(w0.data.driver).toEqual({ view: 'v1', at: T0 });
  let a = session(
    {
      [plus(7)]: { type: 'check', n: 1, items: 2, msgId: 'm1' },
      [plus(8)]: { type: 'answer', n: 1, msgId: 'm2' },
      [plus(9)]: { type: 'extend' },
    },
    base
  );
  const before = sessionState(a, plus(10));
  expect([before.planned, before.leftMs, before.nextCheckAt]).toEqual([30, 20 * 60e3, plus(19)]);
  // the switch at 10: A is ended (a mark and an event)
  const sw = switchSession(a, { at: plus(10), key: sk(plus(10)) });
  expect(sw).toHaveLength(1);
  expect(Object.keys(sw[0]?.data ?? {}).sort()).toEqual(['at', 'endedAt', 'events', 'source', 'status', 'writer']);
  a = apply(a, sw);
  expect(a.status).toBe('ended');
  expect(switchedAt(a)).toBe(plus(10));
  const ended = sessionState(a, plus(10, 20));
  expect([ended.minutes, ended.nextCheckAt]).toEqual([10, null]);
  expect(switchSession(a, { at: plus(11), key: sk(plus(11)) })).toEqual([]);
  let b: SessionDoc = {
    ...session({}, { ...base, id: 'ss-20261018-151000-new-note', startedAt: plus(10) }),
    events: { [sk(plus(10, 1))]: { type: 'start', len: 0, h: noteMark('').h } },
  };
  // Undo 20 s later: B discarded, A active again; nothing removed
  const undo = undoSwitch(a, b, { at: plus(10, 20), keys: [sk(plus(10, 20)), sk(plus(10, 21))] });
  expect(undo).toHaveLength(2);
  expect(undo.every((w) => w.op === 'update')).toBe(true);
  const evBefore = Object.keys(a.events ?? {}).length;
  a = apply(a, undo);
  b = apply(b, undo);
  expect(b.status).toBe('discarded');
  expect(Object.values(b.events ?? {}).filter((e) => e.type === 'end')).toHaveLength(1);
  expect([a.status, a.endedAt]).toEqual(['active', null]);
  expect(Object.keys(a.events ?? {})).toHaveLength(evBefore + 1);
  expect(switchedAt(a)).toBeNull();
  const after = sessionState(a, plus(10, 20));
  expect([after.minutes, after.leftMs, after.nextCheckAt, after.answered[1], after.checks]).toEqual([10, 20 * 60e3, plus(19, 20), 'm2', 1]);
  expect(undoSwitch(a, b, { at: plus(11), keys: [sk(plus(11)), sk(plus(11, 1))] })).toEqual([]);
  // the clock runs out at 30 study minutes, and the session ends then
  expect(sessionState(a, plus(30, 10)).timeUp).toBe(false);
  expect(sessionState(a, plus(30, 20)).timeUp).toBe(true);
  expect(sessionState(a, plus(40)).shouldWrap).toBe(false);
  // Undo changes nothing once the ended session is filed, or past the window
  const filed = { ...apply(session({}, base), switchSession(session({}, base), { at: plus(12), key: sk(plus(12)) })), filedAt: plus(13) };
  const late = { ...b, status: 'active' as const };
  expect(undoSwitch(filed, late, { at: plus(13), keys: [sk(plus(13)), sk(plus(13, 1))] })).toEqual([]);
  const e = apply(session({}, base), switchSession(session({}, base), { at: plus(12), key: sk(plus(12)) }));
  expect(switchedAt(e)).toBe(plus(12));
  expect(undoSwitch(e, late, { at: plus(12, 11), keys: [sk(plus(12, 11)), sk(plus(12, 12))], windowMs: 12e3 })).toHaveLength(2);
  expect(undoSwitch(e, late, { at: plus(12, 12), keys: [sk(plus(12, 12)), sk(plus(12, 13))], windowMs: 12e3 })).toEqual([]);
  expect(undoSwitch(null, late, { at: plus(13), keys: ['a', 'b'] })).toEqual([]);
  // a break at the switch is a break again after Undo
  const brk = session({ [plus(3)]: { type: 'break' } }, base);
  let d = apply(brk, switchSession(brk, { at: plus(4), key: sk(plus(4)) }));
  d = apply(d, undoSwitch(d, null, { at: plus(5), keys: [sk(plus(5)), sk(plus(5, 1))] }));
  const ds = sessionState(d, plus(6));
  expect([ds.onBreak, ds.minutes, ds.breakStartedAt]).toEqual([true, 3, plus(5)]);
});

test('the switching view is on the end event; a filing mark is void after a reopen; ending shows its end event', () => {
  const a = session({}, base);
  const [w] = switchSession(a, { at: plus(5), key: sk(plus(5)), view: 'v-9' });
  const s = apply(a, w ? [w] : []);
  expect(Object.values(s.events ?? {}).find((e) => e.type === 'end')).toEqual({ type: 'end', why: 'switched', at: plus(5), view: 'v-9' });
  const mark = { at: plus(6), wrap: { summary: 'x' } };
  expect(filingOf({ ...s, filing: mark })).toEqual(mark);
  expect(filingOf({ ...s, filing: null })).toBeNull();
  const reopened = apply({ ...s, filing: mark }, undoSwitch(s, null, { at: plus(7), keys: [sk(plus(7)), sk(plus(7, 1))] }));
  expect(filingOf({ ...reopened, filing: mark })).toBeNull();
  const wrapping = session({ [plus(9)]: { type: 'end', why: 'idle' } }, { status: 'ending' });
  expect(endingOf(wrapping)).toEqual({ at: plus(9), why: 'idle', view: null });
  expect(endingOf({ ...wrapping, filedAt: plus(10) })).toBeNull();
  expect(endingOf(session({}, { status: 'active' }))).toBeNull();
});

