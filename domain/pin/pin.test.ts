import { expect, test } from 'vitest';
import { parsePin, pinOrder, isPinned, pin, unpin, movePin, visiblePins, orphanPins } from './index.ts';
import type { TargetState } from './index.ts';

const T = '2026-11-03T00:00:00Z';
const p = (id: string, pos: number, c = 'notes') => parsePin({ targetC: c, targetId: id, pos, at: T });

test('parses rows and refuses bad ones', () => {
  expect(p('a', 1).targetId).toBe('a');
  expect(() => parsePin({ targetC: 'notes', targetId: '', pos: 1, at: T })).toThrow();
  expect(() => parsePin({ targetC: 'notes', targetId: 'a', pos: NaN, at: T })).toThrow();
  expect(() => parsePin({ targetC: 'notes', targetId: 'a', pos: 1, at: T, v: 1 })).toThrow();
  expect(() => parsePin(null)).toThrow();
});

test('pin appends once and unpin removes', () => {
  const one = pin([], 'notes', 'a', T);
  const two = pin(one, 'sets', 'b', T);
  expect(two.map((x) => x.pos)).toEqual([1, 2]);
  expect(pin(two, 'notes', 'a', T)).toEqual(two);
  expect(isPinned(two, 'sets', 'b')).toBe(true);
  expect(unpin(two, 'notes', 'a').map((x) => x.targetId)).toEqual(['b']);
  expect(unpin(two, 'notes', 'zz')).toEqual(two);
});

test('order is by pos with stable ties', () => {
  expect(pinOrder([p('b', 2), p('a', 1), p('d', 2, 'sets')]).map((x) => x.targetId)).toEqual(['a', 'b', 'd']);
});

test('movePin renumbers and keeps the rest', () => {
  const list = [p('a', 1), p('b', 2), p('c', 3)];
  const moved = movePin(list, 'notes', 'c', 0, 'later');
  expect(pinOrder(moved).map((x) => x.targetId)).toEqual(['c', 'a', 'b']);
  expect(pinOrder(moved).map((x) => x.pos)).toEqual([1, 2, 3]);
  expect(movePin(list, 'notes', 'a', 9, 'later').find((x) => x.targetId === 'a')?.pos).toBe(3);
  expect(movePin(list, 'notes', 'nope', 0, 'later')).toEqual(list);
  expect(movePin(list, 'notes', 'a', 0, 'later')).toEqual(list);
});

test('deleted targets are hidden but stay stored; missing ones are orphans', () => {
  const list = [p('a', 1), p('b', 2), p('c', 3)];
  const state = (_c: string, id: string): TargetState => (id === 'a' ? 'live' : id === 'b' ? 'deleted' : 'missing');
  expect(visiblePins(list, state).map((x) => x.targetId)).toEqual(['a']);
  expect(orphanPins(list, state)).toEqual(['notes/c']);
  expect(list).toHaveLength(3);
});
