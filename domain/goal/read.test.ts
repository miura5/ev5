import { expect, test } from 'vitest';
import { parseGoal, goalDaysLeft } from './read.ts';

const base = { at: '2026-11-03T00:00:00Z', kind: 'unit' } as const;

test('parses a valid exam and rejects score fields', () => {
  expect(parseGoal({ ...base, title: 'A', date: '2026-11-10' }).title).toBe('A');
  expect(() => parseGoal({ ...base, title: 'A', score: 90 })).toThrow();
  expect(() => parseGoal({ ...base, title: '' })).toThrow();
});

test('an exam kind is any short label, never blank', () => {
  for (const kind of ['unit', 'final', 'quiz', 'Oral defence']) expect(parseGoal({ ...base, title: 'A', kind }).kind).toBe(kind);
  for (const kind of ['', '  ', 'x'.repeat(41), 3]) expect(() => parseGoal({ ...base, title: 'A', kind })).toThrow();
});

test('days left and ordering', () => {
  const a = parseGoal({ ...base, title: 'B', date: '2026-11-10' });
  const b = parseGoal({ ...base, title: 'A', date: '2026-11-05' });
  const c = parseGoal({ ...base, title: 'C', date: null });
  expect(goalDaysLeft(a, '2026-11-03')).toBe(7);
  expect(goalDaysLeft(c, '2026-11-03')).toBe(null);
});
