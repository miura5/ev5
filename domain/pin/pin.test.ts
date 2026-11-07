import { expect, test } from 'vitest';
import { parsePin } from './index.ts';

const T = '2026-11-03T00:00:00Z';
const p = (id: string, pos: number, c = 'notes') => parsePin({ targetC: c, targetId: id, pos, at: T });

test('parses rows and refuses bad ones', () => {
  expect(p('a', 1).targetId).toBe('a');
  expect(() => parsePin({ targetC: 'notes', targetId: '', pos: 1, at: T })).toThrow();
  expect(() => parsePin({ targetC: 'notes', targetId: 'a', pos: NaN, at: T })).toThrow();
  expect(() => parsePin({ targetC: 'notes', targetId: 'a', pos: 1, at: T, v: 1 })).toThrow();
  expect(() => parsePin(null)).toThrow();
});
