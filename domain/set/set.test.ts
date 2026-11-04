import { expect, test } from 'vitest';
import {
  answeredItems,
  editSet,
  itemType,
  parseSet,
  scoreAnswer,
  setDone,
  setShortfall,
  type SetItem,
} from './index.ts';

// Ported from ev4 test/core.test.mjs (a plan drill is done once fully answered) and test/answer-key.test.mjs
// (set shortfall); all data is made up.
const single: SetItem = {
  id: 'd1',
  stem: 'Which finding needs action first?',
  options: ['a', 'b', 'c'],
  correct: [1],
};
const sata: SetItem = {
  id: 'd2',
  stem: 'Which findings are expected?',
  options: ['a', 'b', 'c', 'd'],
  correct: [0, 2],
};
const matrix: SetItem = {
  id: 'd3',
  stem: 'Mark each finding by its meaning.',
  type: 'matrix',
  matrix: {
    columns: ['expected', 'unexpected'],
    rows: [
      { text: 'x', correct: 0 },
      { text: 'y', correct: 1 },
      { text: 'z', correct: 1 },
    ],
  },
};
const base = {
  schema: 3,
  writer: 'worker',
  at: '2026-10-15T15:00:00Z',
  source: 'test',
  kind: 'drill',
  items: [single, sata],
};
const attempt = (date: string) => ({
  k: { at: `${date}T15:00:00Z`, correct: true },
});

test('parseSet accepts an ev4 schema 3 set and refuses stored answers and unknown fields', () => {
  expect(parseSet(base).items).toHaveLength(2);
  expect(() => parseSet({ ...base, answers: {} })).toThrow(/answers/);
  expect(() => parseSet({ ...base, extra: 1 })).toThrow(/extra/);
  expect(() => parseSet({ ...base, schema: 2 })).toThrow(/schema/);
  expect(() => parseSet({ ...base, kind: 'quiz' })).toThrow(/kind/);
  expect(() => parseSet({ ...base, items: [] })).toThrow(/items/);
  expect(() => parseSet({ ...base, items: [{ id: 'x', stem: 's', bogus: 1 }] })).toThrow(/bogus/);
  expect(() =>
    parseSet({
      ...base,
      items: [{ ...matrix, matrix: { columns: ['a'], rows: [] } }],
    }),
  ).toThrow(/matrix/);
  expect(() => parseSet({ ...base, items: [{ ...single, sourceRef: 'x/1' }] })).toThrow(/sourceRef/);
  expect(parseSet({ ...base, items: [matrix], asked: 3 }).asked).toBe(3);
});

test('scoring: single, select-all (plus/minus, floored at 0) and matrix', () => {
  expect(itemType(sata)).toBe('sata');
  expect(scoreAnswer(single, [1])).toEqual({ correct: true, score: 1 });
  expect(scoreAnswer(single, [0])).toEqual({ correct: false, score: 0 });
  expect(scoreAnswer(sata, [2, 0])).toEqual({ correct: true, score: 1 });
  expect(scoreAnswer(sata, [0])).toEqual({ correct: false, score: 0.5 });
  expect(scoreAnswer(sata, [0, 1, 3]).score).toBe(0);
  expect(scoreAnswer(matrix, [0, 1, 0])).toEqual({
    correct: false,
    score: 2 / 3,
  });
  expect(scoreAnswer(matrix, [0, 1, 1]).correct).toBe(true);
});

test('a drill is done once every item has an attempt, right or wrong', () => {
  const set = parseSet(base);
  expect(setDone(set, { d1: attempt('2026-10-17') })).toBe(false);
  expect(answeredItems(set, { d1: attempt('2026-10-17') })).toEqual(['d1']);
  expect(
    setDone(set, {
      d1: attempt('2026-10-17'),
      d2: { k: { at: '2026-10-17T16:00:00Z', correct: false } },
    }),
  ).toBe(true);
});

test('a set short of the count asked for says so in its header', () => {
  const set = parseSet({ ...base, asked: 4 });
  expect(setShortfall(set)).toBe('2 of 4: 2 didn’t pass E.V.’s checks');
  expect(setShortfall(parseSet(base))).toBe('');
});

test('editing copies into an own set and leaves the original and its answers untouched', () => {
  const original = parseSet({ ...base, writer: 'morning' });
  const frozen = JSON.stringify(original);
  const answers = { d1: attempt('2026-10-17') };
  const edited = editSet(
    original,
    [{ ...single, stem: 'Which finding needs action first, and why?' }],
    '2026-10-20T12:00:00Z',
  );
  expect(JSON.stringify(original)).toBe(frozen);
  expect(edited.writer).toBe('page');
  expect(edited.items).toHaveLength(1);
  expect(() => parseSet(edited)).not.toThrow();
  expect(setDone(edited, answers)).toBe(true);
  expect(setDone(original, answers)).toBe(false);
});
