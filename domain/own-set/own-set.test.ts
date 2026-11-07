import { expect, test } from 'vitest';
import { parseSet, type SetItem } from '../set/index.ts';
import {
  addItem,
  appendAttempt,
  attemptBody,
  attemptsAsAnswers,
  copyOnFirstEdit,
  deleteItem,
  nextAttemptKey,
  orderedItems,
  ownSetDone,
  ownSetProblems,
  parseOwnAttempt,
  parseOwnSet,
  parseOwnSetItem,
  updateItem,
} from './index.ts';
import type { OwnAttempt } from './types.ts';

const NOW = '2026-11-03T10:00:00Z';
const q = (id: string, correct = [1]): SetItem => ({
  ...(correct.length > 1 ? { type: 'multi_select' as const } : {}),
  id,
  stem: 'Which finding needs action first?',
  options: ['a', 'b', 'c'],
  correct,
});
const ev4 = parseSet({
  schema: 3,
  writer: 'worker',
  at: NOW,
  source: 'test',
  kind: 'drill',
  title: 'Key drill',
  items: [q('d1'), q('d2', [0, 2])],
});
const at = (itemId: string, key: string, body: OwnAttempt['body']): OwnAttempt => ({
  setId: 'o1',
  itemId,
  key,
  at: NOW,
  body,
});

test('parses rows and refuses bad ones', () => {
  const set = {
    id: 'o1',
    title: 'Mine',
    type: 'question',
    sourceC: null,
    sourceId: null,
    at: NOW,
    v: 1,
  };
  expect(parseOwnSet(set).title).toBe('Mine');
  expect(() => parseOwnSet({ ...set, sourceC: 'sets' })).toThrow();
  expect(() => parseOwnSet({ ...set, type: 'card' })).toThrow();
  expect(() => parseOwnSet({ ...set, extra: 1 })).toThrow();
  const item = {
    setId: 'o1',
    itemId: 'd1',
    pos: 1,
    body: q('d1'),
    at: NOW,
    v: 1,
  };
  expect(parseOwnSetItem(item).itemId).toBe('d1');
  expect(() => parseOwnSetItem({ ...item, itemId: 'zz' })).toThrow();
  expect(() => parseOwnSetItem({ ...item, body: { id: 'd1', stem: 'short' } })).toThrow();
  expect(parseOwnAttempt(at('d1', 'a1', { chosen: [1], correct: true, score: 1 })).key).toBe('a1');
  expect(() => parseOwnAttempt(at('d1', 'a1', {}))).toThrow();
  expect(() => parseOwnAttempt(at('d1', 'a1', { chosen: [-1] }))).toThrow();
});

test('first edit copies an ev4 set and leaves the original alone', () => {
  const before = JSON.stringify(ev4);
  const { set, items, hide } = copyOnFirstEdit(ev4, 's-9', 'o1', NOW);
  expect(JSON.stringify(ev4)).toBe(before);
  expect(parseOwnSet(set)).toMatchObject({
    title: 'Key drill',
    sourceC: 'sets',
    sourceId: 's-9',
  });
  expect(items.map((i) => [i.itemId, i.pos])).toEqual([
    ['d1', 1],
    ['d2', 2],
  ]);
  items.forEach(parseOwnSetItem);
  expect(hide).toEqual({ c: 'sets', id: 's-9' });
});

test('add, update, delete and order', () => {
  let items = copyOnFirstEdit(ev4, 's-9', 'o1', NOW).items;
  items = addItem(items, 'o1', q('d3'), NOW);
  expect(items.at(-1)?.pos).toBe(3);
  expect(() => addItem(items, 'o1', q('d3'), NOW)).toThrow();
  expect(() => addItem(items, 'o1', { id: 'x', stem: 'tiny' }, NOW)).toThrow();
  items = updateItem(items, 'd1', { ...q('d1'), stem: 'Which finding needs action first now?' }, NOW);
  expect(items[0]?.v).toBe(2);
  expect(() => updateItem(items, 'd1', q('d2'), NOW)).toThrow();
  expect(() => updateItem(items, 'nope', q('nope'), NOW)).toThrow();
  items = deleteItem(items, 'd2');
  expect(orderedItems([...items].reverse()).map((i) => i.itemId)).toEqual(['d1', 'd3']);
});

test('attempts are append-only and feed the answers shape', () => {
  const body = attemptBody(q('d1'), [1]);
  expect(body).toEqual({ chosen: [1], correct: true, score: 1 });
  expect(() => attemptBody({ id: 'n', stem: 'x', type: 'numeric' }, [1])).toThrow();
  let attempts: OwnAttempt[] = [];
  expect(nextAttemptKey(attempts, 'o1', 'd1')).toBe('a1');
  attempts = appendAttempt(attempts, at('d1', 'a1', body));
  expect(() => appendAttempt(attempts, at('d1', 'a1', body))).toThrow();
  attempts = appendAttempt(
    attempts,
    at('d1', nextAttemptKey(attempts, 'o1', 'd1'), {
      chosen: [0],
      correct: false,
    }),
  );
  expect(attemptsAsAnswers(attempts, 'o1')).toEqual({
    d1: { a1: { at: NOW, correct: true }, a2: { at: NOW, correct: false } },
  });
  const items = copyOnFirstEdit(ev4, 's-9', 'o1', NOW).items;
  expect(ownSetDone(items, attempts)).toBe(false);
  expect(ownSetDone(items, [...attempts, at('d2', 'a1', { chosen: [0, 2] })])).toBe(true);
  expect(ownSetDone([], attempts)).toBe(false);
});

test('problems are reported, never dropped', () => {
  const { set, items } = copyOnFirstEdit(ev4, 's-9', 'o1', NOW);
  expect(ownSetProblems([set], items, [at('d1', 'a1', { chosen: [1] })])).toEqual([]);
  const bad = [...items, { ...items[0]!, pos: 2 }, { ...items[0]!, setId: 'zz' }];
  expect(ownSetProblems([set], bad, [{ ...at('d1', 'a1', { chosen: [1] }), setId: 'zz' }])).toEqual([
    'o1/d1: listed twice',
    'zz/d1: set does not exist',
    'o1@2: two items share a position',
    'zz/d1/a1: attempt has no set',
  ]);
});
