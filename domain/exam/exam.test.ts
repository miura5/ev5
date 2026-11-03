import { expect, test } from 'vitest';
import { parseExam, isUpcoming, examDaysLeft, sortUpcoming } from './index.ts';

const base = { schema: 2, writer: 'page', at: '2026-11-03T00:00:00Z', source: 't', kind: 'unit' } as const;

test('parses a valid exam and rejects score fields', () => {
  expect(parseExam({ ...base, title: 'A', date: '2026-11-10' }).title).toBe('A');
  expect(() => parseExam({ ...base, title: 'A', score: 90 })).toThrow();
  expect(() => parseExam({ ...base, title: '' })).toThrow();
  expect(() => parseExam({ ...base, title: 'A', kind: 'quiz' })).toThrow();
});

test('days left and ordering', () => {
  const a = parseExam({ ...base, title: 'B', date: '2026-11-10' });
  const b = parseExam({ ...base, title: 'A', date: '2026-11-05' });
  const c = parseExam({ ...base, title: 'C', date: null });
  const d = parseExam({ ...base, title: 'D', status: 'done', date: '2026-11-01' });
  expect(examDaysLeft(a, '2026-11-03')).toBe(7);
  expect(examDaysLeft(c, '2026-11-03')).toBe(null);
  expect(isUpcoming(d)).toBe(false);
  expect(sortUpcoming([a, c, d, b]).map((e) => e.title)).toEqual(['A', 'B', 'C']);
});
