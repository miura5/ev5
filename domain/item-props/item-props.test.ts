import { expect, test } from 'vitest';
import { parseItemProps, materialize, missingOccurrences } from './index.ts';

const at = '2026-11-03T10:00:00Z';
const base = {
  c: 'plan',
  id: 'x1',
  time: null,
  repeat: null,
  linked: null,
  overrides: null,
  at,
  v: 1,
};
const row = (o: object = {}) => parseItemProps({ ...base, ...o });
const plan = { text: 'Flashcards', kind: 'review' as const, minutes: 15 };

test('parses a row and refuses bad ones', () => {
  expect(row().repeat).toBe(null);
  expect(
    row({
      time: '09:30',
      linked: { c: 'notes', id: 'n1' },
      overrides: { minutes: 20 },
    }).time,
  ).toBe('09:30');
  expect(row({ repeat: { kind: 'weekly', days: [3, 1, 3] } }).repeat).toEqual({
    kind: 'weekly',
    days: [1, 3],
  });
  expect(() => row({ time: '9:30' })).toThrow();
  expect(() => row({ time: '24:00' })).toThrow();
  expect(() => row({ v: 0 })).toThrow();
  expect(() => row({ x: 1 })).toThrow();
  expect(() => row({ linked: { c: 'notes' } })).toThrow();
  expect(() => row({ overrides: { a: { b: 1 } } })).toThrow();
  expect(() => parseItemProps({ ...base, repeat: undefined })).toThrow();
  expect(() => parseItemProps('x')).toThrow();
});

test('repeat rules are validated', () => {
  expect(row({ repeat: { kind: 'daily' } }).repeat).toEqual({ kind: 'daily' });
  expect(row({ repeat: { kind: 'every', n: 2, start: '2026-11-03' } }).repeat).toEqual({
    kind: 'every',
    n: 2,
    start: '2026-11-03',
  });
  for (const repeat of [
    { kind: 'monthly' },
    { kind: 'daily', n: 1 },
    { kind: 'weekly', days: [] },
    { kind: 'weekly', days: [7] },
    { kind: 'every', n: 0, start: '2026-11-03' },
    { kind: 'every', n: 2, start: '2026-02-30' },
    { kind: 'every', n: 2 },
    'daily',
  ])
    expect(() => row({ repeat })).toThrow();
});

test('materializes one occurrence per matching day under rep-<id>-<date>', () => {
  const r = row({ repeat: { kind: 'weekdays' } });
  const found = materialize(r, plan, '2026-11-06', '2026-11-10', at);
  expect(found.map((o) => o.key)).toEqual(['rep-x1-2026-11-06', 'rep-x1-2026-11-09', 'rep-x1-2026-11-10']);
  expect(found[0]).toEqual({
    date: '2026-11-06',
    key: 'rep-x1-2026-11-06',
    entry: { text: 'Flashcards', kind: 'review', minutes: 15, at, by: 'Matt' },
  });
  expect(materialize(row(), plan, '2026-11-06', '2026-11-10', at)).toEqual([]);
});

test('re-running adds no duplicates and keeps skips', () => {
  const found = materialize(row({ repeat: { kind: 'daily' } }), plan, '2026-11-03', '2026-11-03', at);
  expect(missingOccurrences(null, found)).toEqual(found);
  expect(missingOccurrences({ added: {} }, found)).toEqual(found);
  expect(missingOccurrences({ added: { 'rep-x1-2026-11-03': {} } }, found)).toEqual([]);
  expect(missingOccurrences({ skipped: { 'rep-x1-2026-11-03': {} } }, found)).toEqual([]);
});
