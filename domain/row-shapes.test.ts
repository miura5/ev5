import { expect, test } from 'vitest';
import { parseDeletion } from './deletion/index.ts';
import { parseJobPlanRow, parseStoredPlan, parseStoredPlanBody } from './job-plan/index.ts';
import { parseJobRecord } from './job-record/index.ts';
import { parseCeilingHold, parseCeilingUsage, parseCeilingUse } from './ceiling/index.ts';

const T = '2026-11-05T00:00:00Z';
const N = 1_762_300_800_000;

test('a deletions row parses and refuses extras', () => {
  expect(parseDeletion({ c: 'notes', id: 'note-1', at: N }).id).toBe('note-1');
  expect(() => parseDeletion({ c: 'notes', id: '', at: N })).toThrow();
  expect(() => parseDeletion({ c: 'notes', id: 'a', at: N, v: 1 })).toThrow();
});

test('a stored job_plans row is parsed on read', () => {
  expect(parseStoredPlan({ job_id: 'j', body: '{"a":1}' })).toEqual({ jobId: 'j', body: { a: 1 } });
  expect(parseStoredPlanBody({ body: '[1]' })).toEqual([1]);
  expect(() => parseStoredPlanBody({ body: 5 })).toThrow();
  expect(() => parseStoredPlan({ body: '{}' })).toThrow();
});

test('a job_plans row keeps any body', () => {
  expect(parseJobPlanRow({ jobId: 'j', kind: 'plan', body: { a: 1 }, at: N }).kind).toBe('plan');
  expect(() => parseJobPlanRow({ jobId: 'j', kind: '', body: 1, at: N })).toThrow();
});

test('a job record parses, and a bad state is refused', () => {
  const rec = { id: 'j', kind: 'practice-set', title: 't', state: 'queued', costCents: 0, createdAt: T, updatedAt: T, v: 1 };
  expect(parseJobRecord(rec).state).toBe('queued');
  expect(parseJobRecord({ ...rec, output: { home: 'library', id: 'x' } }).output?.id).toBe('x');
  expect(() => parseJobRecord({ ...rec, state: 'paused' })).toThrow();
  expect(() => parseJobRecord({ ...rec, v: 0 })).toThrow();
});

test('ceiling rows parse', () => {
  expect(parseCeilingUse({ w: 'day', k: '2026-11-05', used: 5 }).used).toBe(5);
  expect(() => parseCeilingUse({ w: 'year', k: 'x', used: 0 })).toThrow();
  const hold = { id: 'h', amount: 10, limits: [{ window: 'job', key: 'j', limit: 100 }], open: true };
  expect(parseCeilingHold(hold).limits).toHaveLength(1);
  expect(() => parseCeilingHold({ ...hold, amount: -1 })).toThrow();
  expect(parseCeilingUsage({ key: 'k', holdId: 'h' }).holdId).toBe('h');
});
