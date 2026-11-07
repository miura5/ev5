import { test } from "vitest";
import assert from 'node:assert/strict';
import { buildContext, checkPlan } from './job.ts';
import type { Plan } from './job.ts';

const exam = {
  id: 'e1',
  schema: 2 as const,
  writer: 'page' as const,
  at: '2026-11-03T12:00:00Z',
  source: 't',
  title: 'Unit 3',
  kind: 'exam' as const,
  date: '2026-11-08',
};
const ctxOn = (today: string) => buildContext({ exam, spots: [], today });
const one = (date: string): Plan => ({ summary: 's', tasks: [{ date, title: 'x', minutes: 30 }] });

test('a context built on a later day starts that day', () => {
  const ctx = ctxOn('2026-11-05');
  assert.deepEqual(ctx.days, ['2026-11-05', '2026-11-06', '2026-11-07']);
});

test('checkPlan refuses past days and the exam day', () => {
  const ctx = ctxOn('2026-11-05');
  assert.match(checkPlan(one('2026-11-03'), ctx).join(' '), /already passed/);
  assert.match(checkPlan(one('2026-11-08'), ctx).join(' '), /not plan days/);
  assert.deepEqual(checkPlan(one('2026-11-06'), ctx), []);
});

test('a date whose kind offers no prep plan is refused in plain words', () => {
  assert.throws(
    () => buildContext({ exam: { ...exam, kind: 'other' as 'exam' }, spots: [], today: '2026-11-05' }),
    /Unit 3 has no prep plan/,
  );
});
