import { expect, test } from 'vitest';
import {
  deriveWeakSpot,
  parseWeakSpot,
  isDue,
  isActive,
  isSolid,
  reviewNeed,
  type WeakSpot,
  type Attempt,
} from './index.ts';

// Ported from ev4 test/core.test.mjs (spaced review, pre-read, events); all data is made up.
const at = (date: string, hm = '15:00') => `${date}T${hm}:00Z`; // 15:00Z = 10:00 Central (CDT)
const key = (iso: string, writer = 'page') => `${writer}-${iso.replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}`;
const ev = (iso: string, e: object, writer = 'page') => ({
  [key(iso, writer)]: { ...e },
});
const ws = (id: string, extra: Record<string, unknown> = {}): WeakSpot =>
  parseWeakSpot({
    schema: 2,
    writer: 'page',
    at: at('2026-10-15'),
    source: 'test',
    topic: id,
    objective: 'E4-3',
    exam: 'E4',
    course: 'NUR 112',
    kind: 'concept',
    addedBy: 'test',
    initial: { streak: 0, nextDue: '2026-10-16', recurrence: 1, misses: 0 },
    events: {},
    ...extra,
  });
const att = (date: string, correct: boolean, hm = '15:00'): Attempt => ({
  at: at(date, hm),
  correct,
});

test('spaced review: two right answers on different days make it solid', () => {
  const d = deriveWeakSpot(ws('a'), [att('2026-10-12', true), att('2026-10-13', true)], { examDate: '2026-10-30' });
  expect(d.status).toBe('reviewed');
  expect(d.solidBy).toBe('review');
});
test('spaced review: right twice the same day only counts once', () => {
  const d = deriveWeakSpot(ws('a'), [att('2026-10-12', true, '14:00'), att('2026-10-12', true, '18:00')], {
    examDate: '2026-10-30',
  });
  expect([d.status, d.streak, d.nextDue]).toEqual(['open', 1, '2026-10-15']);
});
test('spaced review: wrong then right the same day advances once (v2 behavior)', () => {
  const d = deriveWeakSpot(ws('a'), [att('2026-10-17', false, '06:31'), att('2026-10-17', true, '14:48')], {
    examDate: '2026-10-21',
  });
  expect([d.status, d.streak, d.nextDue, d.misses]).toEqual(['open', 1, '2026-10-18', 1]);
});
test('spaced review: near the exam the interval is one day and never lands on exam day', () => {
  expect(
    deriveWeakSpot(ws('a'), [att('2026-10-17', true)], {
      examDate: '2026-10-21',
    }).nextDue,
  ).toBe('2026-10-18');
  expect(
    deriveWeakSpot(ws('a'), [att('2026-10-12', true)], {
      examDate: '2026-10-21',
    }).nextDue,
  ).toBe('2026-10-15');
  expect(
    deriveWeakSpot(ws('a'), [att('2026-10-18', true)], {
      examDate: '2026-10-20',
    }).nextDue,
  ).toBe('2026-10-19');
});
test('spaced review: a miss after solid reopens it and raises recurrence', () => {
  const d = deriveWeakSpot(ws('a'), [att('2026-10-12', true), att('2026-10-13', true), att('2026-10-15', false)], {
    examDate: '2026-10-30',
  });
  expect([d.status, d.streak, d.recurrence, d.nextDue]).toEqual(['open', 0, 2, '2026-10-16']);
});
test('D-041 pre-read: the first check after the reading decides it', () => {
  const pre = ws('p', { preRead: true, readingDue: '2026-10-17' });
  expect(deriveWeakSpot(pre, [att('2026-10-18', true)]).solidBy).toBe('first-check-after-reading');
  const missed = deriveWeakSpot(pre, [att('2026-10-18', false)]);
  expect([missed.status, missed.preRead, missed.nextDue, missed.misses]).toEqual(['open', false, '2026-10-19', 1]);
});
test('events: park, activate, owner solid, notes done, seen again', () => {
  const parked = ws('a', {
    events: ev(at('2026-10-16'), { type: 'park', by: 'E.V.' }, 'morning'),
  });
  expect(deriveWeakSpot(parked, [att('2026-10-17', false)]).status).toBe('parked');
  const act = deriveWeakSpot(
    ws('a', {
      events: {
        ...ev(at('2026-10-16'), { type: 'park' }),
        ...ev(at('2026-10-17'), { type: 'activate', by: 'owner' }),
      },
    }),
    [],
  );
  expect([act.status, act.nextDue]).toEqual(['open', '2026-10-17']);
  const solid = ws('a', {
    events: ev(at('2026-10-16'), { type: 'solid', by: 'owner' }),
  });
  expect(deriveWeakSpot(solid, []).solidBy).toBe('owner');
  const done = ws('n', {
    kind: 'note',
    events: ev(at('2026-10-16'), { type: 'done', by: 'owner' }),
  });
  expect(deriveWeakSpot(done, []).status).toBe('reviewed');
  const seen = ws('a', {
    events: ev(at('2026-10-14'), { type: 'seen', by: 'Study Watch' }, 'filing'),
  });
  const again = deriveWeakSpot(seen, [att('2026-10-12', true), att('2026-10-13', true)]);
  expect([again.status, again.recurrence, again.nextDue]).toEqual(['open', 2, '2026-10-15']);
});
test('events from two writers interleave with answers by time, in any attempt order', () => {
  const w = ws('a', {
    events: {
      ...ev('2026-10-17T01:15:00Z', { type: 'park' }, 'worker'),
      ...ev('2026-10-17T14:00:00Z', { type: 'activate' }),
    },
  });
  const whileParked: Attempt = { at: '2026-10-17T05:00:00Z', correct: false };
  const d = deriveWeakSpot(w, [att('2026-10-16', true), whileParked, att('2026-10-17', true)]);
  expect([d.status, d.streak, d.answered, d.misses]).toEqual(['open', 1, 2, 0]);
  expect(deriveWeakSpot(w, [att('2026-10-17', true), whileParked, att('2026-10-16', true)])).toEqual(d);
});
test('the answer that created a spot is not one of its reviews', () => {
  const made: Attempt = { ...att('2026-10-15', false), created: 'a' };
  expect(deriveWeakSpot(ws('a'), [made, att('2026-10-17', true)], { id: 'a' }).answered).toBe(1);
});
test('triage events and the due, solid and need helpers', () => {
  const snoozed = deriveWeakSpot(
    ws('a', {
      events: ev(at('2026-10-16'), { type: 'snooze', until: '2026-10-20' }),
    }),
    [],
  );
  expect([snoozed.status, snoozed.snoozedUntil]).toEqual(['snoozed', '2026-10-20']);
  const open = {
    kind: 'concept',
    derived: deriveWeakSpot(ws('a'), [att('2026-10-17', true)], {
      examDate: '2026-10-30',
    }),
  };
  const got = [isActive(open), isSolid(open), isDue(open, '2026-10-19'), isDue(open, '2026-10-20'), reviewNeed(open)];
  expect(got).toEqual([true, false, false, true, 1]);
  const pre = {
    kind: 'concept',
    readingDue: '2026-10-20',
    derived: deriveWeakSpot(ws('p', { preRead: true }), []),
  };
  expect([isDue(pre, '2026-10-19'), isDue(pre, '2026-10-20'), reviewNeed(pre)]).toEqual([false, true, 1]);
});
test('parse refuses stored derived state and bad shapes', () => {
  expect(() => ws('a', { derived: {} })).toThrow();
  expect(() => ws('a', { kind: 'quiz' })).toThrow();
  expect(() => ws('a', { schema: 1, proposed: true })).toThrow();
  expect(() => ws('a', { events: { 'bad key': { type: 'park' } } })).toThrow();
});
