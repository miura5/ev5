import { expect, test } from 'vitest';
import {
  parseCollection,
  parseMembership,
  nestingProblems,
  canNest,
  effectiveCollection,
  moveWrite,
} from './index.ts';

const col = (id: string, parentId: string | null = null) =>
  parseCollection({ id, title: id, parentId, pos: 1, at: '2026-11-03T00:00:00Z', v: 1 });
const row = (collectionId: string, at = '2026-11-03T10:00:00Z') =>
  parseMembership({ itemC: 'notes', itemId: 'n1', collectionId, at, v: 1 });
const live = new Set(['a', 'b']);

test('parses rows and refuses bad ones', () => {
  expect(col('a').title).toBe('a');
  expect(() => parseCollection({ id: 'a', title: 'a', parentId: 'a', pos: 1, at: 't', v: 1 })).toThrow();
  expect(() => parseCollection({ id: 'a', title: 'a', parentId: null, pos: 1, at: 't', v: 1, x: 1 })).toThrow();
  expect(() => parseMembership({ itemC: 'notes', itemId: '', collectionId: 'a', at: 't', v: 1 })).toThrow();
});

test('nesting is one level', () => {
  const rows = [col('a'), col('b', 'a'), col('c', 'b'), col('d', 'zz')];
  expect(nestingProblems(rows)).toEqual(['c: has a grandparent (a)', 'd: parent zz does not exist']);
  expect(nestingProblems(rows.slice(0, 2))).toEqual([]);
  expect(canNest(rows, null)).toBe(true);
  expect(canNest(rows, 'a')).toBe(true);
  expect(canNest(rows, 'b')).toBe(false);
  expect(canNest(rows, 'zz')).toBe(false);
});

test('effective collection: the membership row, else none', () => {
  expect(effectiveCollection(undefined, live)).toBe(null);
  expect(effectiveCollection(row('a'), live)).toBe('a');
});

test('a deleted collection ungroups its items, and restoring regroups them', () => {
  expect(effectiveCollection(row('a'), new Set(['b']))).toBe(null);
  expect(effectiveCollection(row('a'), live)).toBe('a');
});

test('moves write a row or ungroup, and refuse anything but a live collection', () => {
  expect(moveWrite('a', live)).toEqual({ kind: 'row', collectionId: 'a' });
  expect(moveWrite(null, live)).toEqual({ kind: 'ungroup', removeRow: true });
  expect(() => moveWrite('zz', live)).toThrow();
  expect(() => moveWrite('course:LAND 200', live)).toThrow();
});
