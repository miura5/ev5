import { expect, test } from 'vitest';
import type { Draft, DraftBatch, DraftWrite } from './index.ts';
import { parseDraft, keep, drop, keepAll, keptTally, copyId } from './index.ts';

const NOW = '2026-11-03T12:00:00Z';
const mk = (o: Record<string, unknown> = {}) =>
  parseDraft({
    id: 'd1',
    jobId: 'j1',
    kind: 'set-item',
    targetC: 'own_sets',
    targetId: 's1',
    body: { q: 'Why?' },
    state: 'pending',
    at: '2026-11-03T00:00:00Z',
    v: 2,
    ...o,
  });

test('parses a draft and refuses bad ones', () => {
  expect(mk().kind).toBe('set-item');
  expect(() => mk({ kind: 'note' })).toThrow();
  expect(() => mk({ state: 'done' })).toThrow();
  expect(() => mk({ body: [] })).toThrow();
  expect(() => mk({ v: 0 })).toThrow();
  expect(() => mk({ jobId: '' })).toThrow();
  expect(() => mk({ extra: 1 })).toThrow();
});

test('keeping copies into the home and marks kept in one atomic batch', () => {
  const b = keep(mk(), NOW);
  expect(b.atomic).toBe(true);
  expect(b.writes).toEqual([
    {
      op: 'insert',
      c: 'own_set_items',
      id: 'draft-d1',
      body: { q: 'Why?', draftId: 'd1', setId: 's1' },
    },
    { op: 'mark', c: 'drafts', id: 'd1', state: 'kept', expectV: 2, at: NOW },
  ]);
  expect(copyId(mk())).toBe('draft-d1');
});

test('each kind has its home, and an unverified keep is marked', () => {
  const plan = keep(mk({ kind: 'plan-item', targetC: 'dayedits', targetId: '2026-11-04' }), NOW);
  expect(plan.writes[0]).toMatchObject({ c: 'dayedits', id: '2026-11-04' });
  const save = keep(mk({ kind: 'set-save', targetC: 'sets' }), NOW);
  expect(save.writes[0]).toMatchObject({ c: 'sets', id: 'draft-d1' });
  expect(keep(mk(), NOW, { unverified: true }).writes[0]).toMatchObject({
    body: { unverified: true },
  });
});

test('a draft is kept or dropped once; replanning gives the same copy key', () => {
  expect(() => keep(mk({ state: 'kept' }), NOW)).toThrow('already kept');
  expect(() => keep(mk({ state: 'dropped' }), NOW)).toThrow('already dropped');
  expect(() => drop(mk({ state: 'kept' }), NOW)).toThrow();
  expect(drop(mk(), NOW).writes).toEqual([
    {
      op: 'mark',
      c: 'drafts',
      id: 'd1',
      state: 'dropped',
      expectV: 2,
      at: NOW,
    },
  ]);
  expect(keep(mk(), NOW).writes[0]).toEqual(keep(mk(), NOW).writes[0]);
});

test('keep all skips settled drafts and the tally counts kept of total', () => {
  const ds = [mk(), mk({ id: 'd2' }), mk({ id: 'd3', state: 'kept' }), mk({ id: 'd4', state: 'dropped' })];
  const b = keepAll(ds, NOW);
  expect(b.writes.map((w) => `${w.op}:${w.id}`)).toEqual(['insert:draft-d1', 'mark:d1', 'insert:draft-d2', 'mark:d2']);
  expect(keptTally(ds)).toEqual({ kept: 1, total: 4 });
});

test('batches are typed writes', () => {
  const d: Draft = mk();
  const b: DraftBatch = keep(d, NOW);
  const w: DraftWrite | undefined = b.writes[1];
  expect(w?.op).toBe('mark');
});
