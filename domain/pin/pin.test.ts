import { expect, test } from 'vitest';
import { parsePin, orderPins, visiblePins, isPinned, nextPos, pinAt } from './index.ts';

const pin = (targetId: string, pos: number, at = '2026-11-03T00:00:00Z', targetC = 'notes') =>
  parsePin({ targetC, targetId, pos, at, v: 1 });

test('parses a row and refuses bad ones', () => {
  expect(pin('n1', 1).targetId).toBe('n1');
  expect(() => parsePin(null)).toThrow();
  expect(() => parsePin({ targetC: 'notes', targetId: '', pos: 1, at: 't', v: 1 })).toThrow();
  expect(() => parsePin({ targetC: 'notes', targetId: 'n', pos: NaN, at: 't', v: 1 })).toThrow();
  expect(() => parsePin({ targetC: 'notes', targetId: 'n', pos: 1, at: 't', v: 0 })).toThrow();
  expect(() => parsePin({ targetC: 'notes', targetId: 'n', pos: 1, at: 't', v: 1, x: 1 })).toThrow();
});

test('orders by pos, then pinned time, and does not mutate', () => {
  const rows = [pin('c', 2), pin('b', 1, '2026-11-03T05:00:00Z'), pin('a', 1)];
  expect(orderPins(rows).map((p) => p.targetId)).toEqual(['a', 'b', 'c']);
  expect(rows[0]?.targetId).toBe('c');
});

test('pins to missing items are hidden, not removed', () => {
  const rows = [pin('a', 1), pin('gone', 2), pin('c', 3)];
  expect(visiblePins(rows, (_c, id) => id !== 'gone').map((p) => p.targetId)).toEqual(['a', 'c']);
  expect(rows).toHaveLength(3);
});

test('lookup and next position', () => {
  const rows = [pin('a', 1), pin('b', 4, 't', 'sets')];
  expect(isPinned(rows, 'sets', 'b')).toBe(true);
  expect(isPinned(rows, 'notes', 'b')).toBe(false);
  expect(pinAt(rows, 'notes', 'a')?.pos).toBe(1);
  expect(nextPos(rows)).toBe(5);
  expect(nextPos([])).toBe(1);
});
