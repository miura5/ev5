import { expect, test } from 'vitest';
import {
  noteDelta,
  noteMark,
  parseSession,
  readAlongAsk,
  sessionState,
  startSession,
  type SessionDoc,
  type SessionEvent,
} from './index.ts';
import { plus, session, sk, T0 } from './fixtures.ts';

// Ported from ev4 test/sessions.test.mjs: the timer, writing clock, ring, note delta, comment mode, read-along.

test('timer: checks every 7 min; breaks keep the remaining time; +5 min; idle checks wrap up', () => {
  let st = sessionState(session({}), plus(3));
  expect(st.nextCheckAt).toBe(plus(7));
  expect(st.due).toBe(false);
  expect(st.minutes).toBe(3);
  expect(sessionState(session({}), plus(7, 5)).due).toBe(true);
  st = sessionState(session({ [plus(7)]: { type: 'check', n: 1, items: 3, len: 10, h: 'x', msgId: 'm1' } }), plus(8));
  expect(st.checks).toBe(1);
  expect(st.questions).toBe(3);
  expect(st.nextCheckAt).toBe(plus(14));
  expect(st.lastMark).toEqual({ noteId: null, len: 10, h: 'x', modifiedAt: null });
  // break at 9 (5 min left), resume at 30: next check 5 min later; break time isn't study time
  st = sessionState(
    session({
      [plus(7)]: { type: 'check', n: 1, items: 2 },
      [plus(9)]: { type: 'break' },
      [plus(30)]: { type: 'resume' },
    }),
    plus(31)
  );
  expect(st.onBreak).toBe(false);
  expect(st.nextCheckAt).toBe(plus(35));
  expect(st.minutes).toBe(10);
  st = sessionState(session({ [plus(2)]: { type: 'break' } }), plus(4));
  expect(st.onBreak).toBe(true);
  expect(st.nextCheckAt).toBeNull();
  expect(st.breakRemainingMs).toBe(5 * 60e3);
  expect(st.minutes).toBe(2);
  st = sessionState(session({ [plus(2)]: { type: 'extend' } }), plus(3));
  expect(st.nextCheckAt).toBe(plus(12));
  st = sessionState(session({ [plus(7)]: { type: 'idle' }, [plus(14)]: { type: 'idle' } }), plus(15));
  expect(st.shouldWrap).toBe(false);
  const idle3 = { [plus(7)]: { type: 'idle' as const }, [plus(14)]: { type: 'idle' as const }, [plus(21)]: { type: 'idle' as const } };
  expect(sessionState(session(idle3), plus(22)).shouldWrap).toBe(true);
  st = sessionState(
    session({ [plus(7)]: { type: 'check', n: 1, items: 1 }, [plus(8)]: { type: 'answer', n: 1, msgId: 'm9' } }),
    plus(9)
  );
  expect(st.answered[1]).toBe('m9');
  st = sessionState(session({}, { status: 'ended', endedAt: plus(40) }), plus(90));
  expect(st.nextCheckAt).toBeNull();
  expect(st.minutes).toBe(40);
});

test('a writing session counts only the time he writes; a pause holds the clock and the checks, a keystroke starts both', () => {
  const w = (events: Record<string, SessionEvent>, extra: Partial<SessionDoc> = {}) =>
    session(events, { clock: 'writing', note: 'notes/n1', noteId: 'n1', ...extra });
  const pause = { type: 'pause' as const, from: plus(10) };
  const ev = { [plus(12)]: pause, [plus(30)]: { type: 'write' as const } };
  let st = sessionState(w({ [plus(12)]: pause }), plus(20));
  expect([st.writing, st.paused, st.pausedAt, st.minutes]).toEqual([true, true, plus(10), 10]);
  expect(st.nextCheckAt).toBeNull();
  expect([st.timeUp, st.planned, st.leftMs]).toEqual([false, null, null]);
  st = sessionState(w(ev), plus(35));
  expect([st.paused, st.minutes, st.activeSince]).toEqual([false, 15, plus(30)]);
  expect(st.nextCheckAt).toBe(plus(30, 30));
  // a check at 7 then a pause at 10: the 4 minutes left to the next check wait for his next keystroke
  st = sessionState(w({ [plus(7)]: { type: 'check', quiet: true, len: 4, h: 'x' }, ...ev }), plus(31));
  expect(st.nextCheckAt).toBe(plus(34));
  // a pause never reaches back before the clock last started: a resume at 20 after a break from 5
  st = sessionState(
    w({ [plus(5)]: { type: 'break' }, [plus(20)]: { type: 'resume' }, [plus(23)]: { type: 'pause', from: plus(4) } }),
    plus(40)
  );
  expect([st.paused, st.pausedAt, st.minutes]).toEqual([true, plus(20), 5]);
  // ended while paused: the minutes are the writing minutes; a reopen stays paused until he writes
  const ended = w({ ...ev, [plus(36)]: { type: 'pause', from: plus(34) }, [plus(50)]: { type: 'end', why: 'ended' } });
  expect(sessionState(ended, plus(50)).minutes).toBe(14);
  const reopened = { ...ended, events: { ...ended.events, [sk(plus(55))]: { type: 'reopen' as const } } };
  st = sessionState(reopened, plus(60));
  expect([st.paused, st.minutes]).toEqual([true, 14]);
  // a write with no pause, and a pause during a break, change nothing
  st = sessionState(w({ [plus(3)]: { type: 'write' }, [plus(4)]: { type: 'break' }, [plus(6)]: { type: 'pause' } }), plus(8));
  expect([st.paused, st.onBreak, st.minutes]).toEqual([false, true, 4]);
  // it ends on neither idle checks nor a clock, only once paused writingWrapMinutes (60)
  const idle3 = { [plus(7)]: { type: 'idle' as const }, [plus(14)]: { type: 'idle' as const }, [plus(21)]: { type: 'idle' as const } };
  expect(sessionState(w(idle3), plus(22)).shouldWrap).toBe(false);
  expect(sessionState(w({ [plus(12)]: pause }), plus(69)).shouldWrap).toBe(false);
  expect(sessionState(w({ [plus(12)]: pause }), plus(70)).shouldWrap).toBe(true);
  // a session without the clock keeps its planned clock: pause and write events are not its
  st = sessionState(session({ [plus(12)]: pause }, { planned: 25 }), plus(20));
  expect([st.paused, st.minutes, st.leftMs]).toEqual([false, 20, 5 * 60e3]);
});

test('the start write: a note session writing has no planned end; a task keeps its minutes; documents parse', () => {
  const a = startSession({ id: 'ss-x', at: T0, key: sk(T0), topic: 'New note', noteId: 'n-1', fresh: true, clock: 'writing' });
  expect(a.data.clock).toBe('writing');
  expect(a.data.planned).toBeUndefined();
  expect(a.data.note).toBe('notes/n-1');
  expect(a.data.date).toBe('2026-10-18');
  expect(Object.values(a.data.events as object)[0]).toEqual({ type: 'start', noteId: 'n-1', ...noteMark('') });
  parseSession(a.data);
  const b = startSession({ id: 'ss-y', at: T0, key: sk(T0), topic: 'Read Ch 40', planned: 30, clock: 'writing' });
  expect([b.data.planned, b.data.clock, b.data.note, b.data.comments]).toEqual([30, undefined, undefined, 'some']);
  parseSession(b.data);
  const withPauses = { ...a.data, events: { ...(a.data.events as object), [sk(plus(3))]: { type: 'pause', from: plus(2) }, [sk(plus(4))]: { type: 'write' } } };
  parseSession(withPauses);
  expect(() => parseSession({ ...a.data, text: 'x' })).toThrow(/never enters/);
  expect(() => parseSession({ ...a.data, schema: 1 })).toThrow(/schema/);
  expect(() => parseSession({ ...a.data, planned: 601 })).toThrow(/planned/);
  expect(() => parseSession({ ...a.data, events: { bad: { type: 'start' } } })).toThrow(/event key/);
});

test('her ring is the stretch to the next check: 0, a quarter, a half, full; it starts over after a check', () => {
  const at = (p: number) => new Date(Date.parse(T0) + p * 7 * 60e3).toISOString();
  expect([0, 0.25, 0.5, 1].map((p) => sessionState(session({}), at(p)).toCheck)).toEqual([0, 0.25, 0.5, 1]);
  expect(sessionState(session({}), plus(9)).toCheck).toBe(1);
  const checked = session({ [plus(7)]: { type: 'check', n: 1, items: 2 } });
  expect(sessionState(checked, plus(7)).toCheck).toBe(0);
  expect(sessionState(checked, plus(10, 30)).toCheck).toBeCloseTo(0.5, 9);
  const answered = session({ [plus(7)]: { type: 'check', n: 1, items: 2 }, [plus(8)]: { type: 'answer', n: 1 } });
  expect(sessionState(answered, plus(10, 30)).toCheck).toBeCloseTo(0.5, 9);
  const ext = session({ [plus(2)]: { type: 'extend' } });
  expect(sessionState(ext, plus(2)).toCheck).toBeCloseTo(2 / 12, 9);
  expect(sessionState(ext, plus(3)).toCheck).toBeCloseTo(3 / 12, 9);
  const brk = session({ [plus(2)]: { type: 'break' } });
  expect(sessionState(brk, plus(2)).toCheck).toBeCloseTo(2 / 7, 9);
  expect(sessionState(brk, plus(20)).toCheck).toBeCloseTo(2 / 7, 9);
  expect(sessionState(session({}, { status: 'ended', endedAt: plus(3) }), plus(4)).toCheck).toBe(0);
});

test('note delta: only the new writing; nothing new is idle; a rewrite falls back to the end', () => {
  const a = 'Fluid balance\nIsotonic: 0.9% NaCl.';
  const m = noteMark(a);
  expect(noteDelta(a + '\nHypotonic: 0.45% NaCl shifts water into cells.', m)).toEqual({
    added: '\nHypotonic: 0.45% NaCl shifts water into cells.',
    same: false,
    rewritten: false,
  });
  expect(noteDelta(a, m).same).toBe(true);
  expect(noteDelta(a + '\n  ', m).same).toBe(true);
  const r = noteDelta('Fluids (rewritten)\nIsotonic fluids stay put.', m);
  expect(r.rewritten).toBe(true);
  expect(r.added).toMatch(/stay put/);
  expect(noteDelta('x'.repeat(3000), null).added).toHaveLength(2500);
  expect(JSON.stringify(m)).not.toContain('Isotonic');
});

test('an event whose time cannot be read is skipped without disturbing the rest', () => {
  const s = session({ [plus(7)]: { type: 'check', n: 1, items: 2 } });
  (s.events as Record<string, SessionEvent>)['not-a-time'] = { type: 'break' };
  const st = sessionState(s, plus(8));
  expect([st.checks, st.onBreak]).toEqual([1, false]);
});

test('comment mode: comments and quiet checkpoints move the mark without counting as checks; a quiz does', () => {
  const t0 = '2026-10-19T19:00:00.000Z';
  const at = (m: number) => new Date(Date.parse(t0) + m * 60e3).toISOString();
  const key = (type: string, m: number) => `${type}-${at(m).replace(/[-:]/g, '').replace('T', '-').replace(/\.\d+Z$/, '')}`;
  const s: SessionDoc = {
    id: 's',
    status: 'active',
    startedAt: t0,
    events: {
      [key('start', 0)]: { type: 'start', at: at(0), len: 10, h: 'a', noteId: 'n' },
      [key('check', 2)]: { type: 'check', at: at(2), comment: true, len: 40, h: 'b', noteId: 'n', msgId: 'm-1' },
      [key('check', 7)]: { type: 'check', at: at(7), quiet: true, len: 60, h: 'c', noteId: 'n' },
      [key('idle', 14)]: { type: 'idle', at: at(14) },
      [key('check', 16)]: { type: 'check', at: at(16), n: 1, items: 2, len: 70, h: 'd', noteId: 'n' },
    },
  };
  const st = sessionState(s, at(17));
  expect([st.checks, st.questions, st.comments, st.reads]).toEqual([1, 2, 1, 3]);
  expect([st.lastMark?.h, st.lastQuizMark?.h]).toEqual(['d', 'd']);
  const mid = sessionState({ ...s, events: Object.fromEntries(Object.entries(s.events ?? {}).slice(0, 3)) }, at(8));
  expect([mid.checks, mid.comments, mid.lastMark?.h, mid.lastQuizMark?.h, mid.idleChecks]).toEqual([0, 1, 'c', 'a', 0]);
});

test('read-along reads new text only, complete lines while typing, at most once per 75 s, and stops after 10 idle minutes', () => {
  const N = Date.parse(T0);
  const b = { changedAt: N, lastAsk: 0, now: N };
  expect(readAlongAsk({ ...b, text: 'Old lines.', seen: null })).toEqual({ ask: false, why: 'first', seen: 'Old lines.' });
  expect(readAlongAsk({ ...b, text: '', seen: '' })).toMatchObject({ why: 'same' });
  expect(readAlongAsk({ ...b, text: 'Old lines.', seen: 'Old lines.' })).toMatchObject({ why: 'same' });
  const line = 'Potassium shifts into cells with insulin.\n';
  const a = readAlongAsk({ ...b, text: 'Old lines.\n' + line, seen: 'Old lines.\n' });
  expect(a).toEqual({ ask: true, added: line, before: 'Old lines.\n', seenNext: 'Old lines.\n' + line });
  expect(readAlongAsk({ ...b, typing: true, text: 'Old lines.\nPotassium shifts into cells', seen: 'Old lines.\n' })).toMatchObject({ why: 'small' });
  expect(readAlongAsk({ ...b, text: 'Old lines.\nK+.', seen: 'Old lines.\n' })).toMatchObject({ why: 'small' });
  const grown = { text: 'Old lines.\n' + line, seen: 'Old lines.\n' };
  expect(readAlongAsk({ ...b, lastAsk: N - 74e3, ...grown })).toMatchObject({ why: 'soon' });
  expect(readAlongAsk({ ...b, lastAsk: N - 75e3, ...grown }).ask).toBe(true);
  expect(readAlongAsk({ ...b, changedAt: N - 10 * 60e3, ...grown })).toMatchObject({ why: 'idle' });
  expect(readAlongAsk({ ...b, changedAt: N - 9 * 60e3, ...grown }).ask).toBe(true);
  const r = readAlongAsk({ ...b, text: 'New start.\n' + line, seen: 'Old lines.\n' });
  expect(r).toEqual({ ask: true, added: 'New start.\n' + line, before: '', seenNext: 'New start.\n' + line });
});
