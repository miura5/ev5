import { expect, test } from 'vitest';
import { parseCourseTable } from '../course/index.ts';
import {
  parseCollection,
  parseMembership,
  courseCollectionId,
  virtualCourse,
  virtualCollections,
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
const old = { course: 'BIO', courseAt: '2026-11-01T00:00:00Z' };

test('parses rows and refuses bad ones', () => {
  expect(col('a').title).toBe('a');
  expect(() => col('course:BIO')).toThrow();
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
  expect(canNest(rows, 'course:BIO')).toBe(false);
});

test('ev4 courses are virtual read-only collections', () => {
  const table = parseCourseTable({
    BIO: {
      status: 'active',
      canvasId: 1,
      examKinds: ['unit'],
      reviewKinds: [],
      examDayKinds: [],
      scoredKinds: [],
      calendarDayKinds: [],
      dayBudget: 'shared',
      library: [],
      default: true,
    },
  });
  expect(virtualCollections(table)).toEqual([{ id: 'course:BIO', title: 'BIO', readOnly: true }]);
  expect(virtualCourse(courseCollectionId('BIO'))).toBe('BIO');
  expect(virtualCourse('a')).toBe(null);
});

test('effective collection: row, else course, newer course wins', () => {
  expect(effectiveCollection({}, undefined, live)).toBe(null);
  expect(effectiveCollection({ course: 'BIO' }, undefined, live)).toBe('course:BIO');
  expect(effectiveCollection(old, row('a'), live)).toBe('a');
  expect(effectiveCollection({ course: 'BIO' }, row('a'), live)).toBe('a');
  expect(effectiveCollection({ course: 'BIO', courseAt: '2026-11-04T00:00:00Z' }, row('a'), live)).toBe('course:BIO');
});

test('a deleted collection ungroups its items, and restoring regroups them', () => {
  expect(effectiveCollection(old, row('a'), new Set(['b']))).toBe(null);
  expect(effectiveCollection(old, row('a'), live)).toBe('a');
});

test('moves write a row, the course, or ungroup', () => {
  expect(moveWrite('a', live)).toEqual({ kind: 'row', collectionId: 'a' });
  expect(moveWrite('course:NUR 112', live)).toEqual({ kind: 'course', course: 'NUR 112', removeRow: true });
  expect(moveWrite(null, live)).toEqual({ kind: 'ungroup', removeRow: true });
  expect(() => moveWrite('zz', live)).toThrow();
});
