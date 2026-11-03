import { expect, test } from 'vitest';
import { materialize, overridden, parseItemProps, parseRepeat, unresolvedLinks } from './index.ts';
import type { PlanTemplate } from './index.ts';

const T = '2026-11-03T00:00:00Z';
const row = (o: Record<string, unknown> = {}) =>
  parseItemProps({
    c: 'dayedits',
    id: 'p1',
    time: '09:30',
    repeat: { kind: 'daily' },
    linkedC: null,
    linkedId: null,
    overrides: null,
    at: T,
    v: 1,
    ...o,
  });
const tpl: PlanTemplate = { text: 'Review flashcards', kind: 'review', minutes: 20 };

test('parses rows and refuses bad ones', () => {
  expect(row().time).toBe('09:30');
  expect(row({ repeat: null, time: null }).repeat).toBeNull();
  expect(() => row({ time: '9:30' })).toThrow();
  expect(() => row({ time: '24:00' })).toThrow();
  expect(() => row({ linkedC: 'notes' })).toThrow();
  expect(() => row({ x: 1 })).toThrow();
  expect(() => row({ v: 0 })).toThrow();
  expect(() => row({ overrides: { a: {} } })).toThrow();
});

test('repeat rules are validated and normalised', () => {
  expect(parseRepeat({ kind: 'weekly', days: [3, 1, 3] })).toEqual({ kind: 'weekly', days: [1, 3] });
  expect(() => parseRepeat({ kind: 'weekly', days: [] })).toThrow();
  expect(() => parseRepeat({ kind: 'weekly', days: [7] })).toThrow();
  expect(() => parseRepeat({ kind: 'every', n: 0, start: '2026-11-03' })).toThrow();
  expect(() => parseRepeat({ kind: 'monthly' })).toThrow();
  expect(parseRepeat({ kind: 'every', n: 2, start: '2026-11-03' })).toEqual({
    kind: 'every',
    n: 2,
    start: '2026-11-03',
  });
});

test('materialize writes each day under rep-<id>-<date>', () => {
  const out = materialize(row(), tpl, '2026-11-03', '2026-11-05', () => false, T);
  expect(out.map((o) => o.key)).toEqual(['rep-p1-2026-11-03', 'rep-p1-2026-11-04', 'rep-p1-2026-11-05']);
  expect(out[0]?.entry).toEqual({ ...tpl, at: T, by: 'Matt' });
  expect(materialize(row({ repeat: null }), tpl, '2026-11-03', '2026-11-05', () => false, T)).toEqual([]);
});

test('materialize is idempotent: stored keys are skipped, also across a restore', () => {
  const store = new Set<string>();
  const have = (d: string, k: string) => store.has(`${d}|${k}`);
  const run = () => {
    const out = materialize(row({ repeat: { kind: 'weekdays' } }), tpl, '2026-11-02', '2026-11-08', have, T);
    for (const o of out) store.add(`${o.date}|${o.key}`);
    return out.length;
  };
  expect(run()).toBe(5);
  expect(run()).toBe(0);
  const restored = new Set(store);
  store.clear();
  for (const k of restored) store.add(k);
  expect(run()).toBe(0);
});

test('materialize crosses the fall DST change on plain dates', () => {
  const out = materialize(row(), tpl, '2026-10-31', '2026-11-02', () => false, T);
  expect(out.map((o) => o.date)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
});

test('unresolved links are reported and overrides win', () => {
  const linked = row({ linkedC: 'notes', linkedId: 'n9' });
  expect(unresolvedLinks([linked, row()], () => false)).toEqual(['dayedits/p1: linked notes/n9 does not exist']);
  expect(unresolvedLinks([linked], () => true)).toEqual([]);
  const ov = row({ overrides: { minutes: 45 } });
  expect(overridden(ov, 'minutes', 20)).toBe(45);
  expect(overridden(ov, 'text', 'x')).toBe('x');
  expect(overridden(undefined, 'text', 'x')).toBe('x');
});
