import { expect, test } from 'vitest';
import { draftKey, parseDraftTableRow } from './index.ts';

const row = {
  id: 'draft_1',
  job_id: 'job_1',
  kind: 'set-item',
  target_kind: 'sets',
  target_id: 'set_1',
  body: { q: 'x' },
  state: 'pending',
  at: 1_762_300_800_000,
  v: 1,
};

test('a drafts table row parses with target_kind and a draft_ id', () => {
  expect(parseDraftTableRow(row).target_kind).toBe('sets');
});

test('the old target_c column, an unprefixed id and a bad state are refused', () => {
  const { target_kind: _t, ...rest } = row;
  expect(() => parseDraftTableRow({ ...rest, target_c: 'sets' })).toThrow();
  expect(() => parseDraftTableRow({ ...row, id: 'd1' })).toThrow();
  expect(() => parseDraftTableRow({ ...row, state: 'open' })).toThrow();
});

test('draftKey adds the prefix once', () => {
  expect(draftKey('job_1:d0')).toBe('draft_job_1:d0');
  expect(draftKey('draft_job_1:d0')).toBe('draft_job_1:d0');
});
