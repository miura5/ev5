import { expect, test } from 'vitest';
import { byName, commands, paletteEntries, scheduleEntries, tools } from './catalog.ts';
import { commandNames, paletteEntries as clientPalette } from './client.ts';
import { defineCommand, none, ref, resolveCall, suggest } from './define.ts';

const must = (name: string) => byName(name)!;

test('the registry holds PLAN 6.1 and the generated names match it', () => {
  expect(commands.map(c => c.name)).toEqual([...commandNames]);
  for (const n of ['item.pin', 'plan.create', 'proposal.accept', 'date.plan_with_ev', 'weakspot.mark_learned', 'set.write_with_ev',
    'study.just_tell_me', 'job_status', 'ask.send', 'weekly_review', 'canvas_sync']) expect(byName(n), n).toBeTruthy();
  expect(new Set(commandNames).size).toBe(commandNames.length);
});

test('E.V. never gets delete, restore, pin, approve, keep, drop, mark as learned or just tell me', () => {
  const bad = /delete|restore|pin|approve|accept|keep|drop|mark_learned|just_tell_me/;
  for (const t of tools()) expect(bad.test(t.name), t.name).toBe(false);
});

test('E.V.: plan changes are proposals; job_status is direct', () => {
  expect(must('plan.create').callers.ev).toBe('propose');
  expect(must('job_status').callers.ev).toBe('direct');
  const names = tools().map(t => t.name);
  expect(names).toContain('plan__create');
  expect(names).toContain('job_status');
  expect(names).not.toContain('item__pin');
});

test('a propose call comes back as a Suggestion, a refused caller does not', () => {
  const cmd = must('plan.create');
  const call = resolveCall(cmd, 'ev', { title: 'Read ch 4' });
  expect(call).toEqual({ ok: true, mode: 'propose', input: { title: 'Read ch 4' } });
  expect(suggest(cmd, { title: 'Read ch 4' })).toEqual({ command: 'plan.create', input: { title: 'Read ch 4' }, title: 'Add a plan item' });
  expect(resolveCall(must('item.delete'), 'ev', { id: 'x' }).ok).toBe(false);
  expect(resolveCall(cmd, 'matt', {}).ok).toBe(false);
});

test('defineCommand refuses what the contract forbids', () => {
  const base = { title: 't', input: none, effect: 'instant' } as const;
  expect(() => defineCommand({ ...base, name: 'item.pin', callers: { ev: 'direct' } })).toThrow(/never call/);
  expect(() => defineCommand({ ...base, name: 'plan.x', callers: { ev: 'direct' }, changesPlan: true })).toThrow(/propose/);
  expect(() => defineCommand({ ...base, name: 'Bad Name', callers: { matt: 'direct' } })).toThrow(/name/);
  expect(() => defineCommand({ ...base, name: 'x.y', callers: { schedule: 'direct' } })).toThrow(/cadence/);
  expect(defineCommand({ ...base, name: 'x.y', input: ref, callers: { matt: 'direct' } })).toBeTruthy();
});

test('the generated client carries the palette entries as plain data', () => {
  expect(clientPalette).toEqual(paletteEntries());
  expect(clientPalette.find(e => e.name === 'plan.create')?.places).toEqual(['today']);
});

test('palette and schedule entries come from the registry', () => {
  expect(paletteEntries().map(e => e.name)).toContain('theme.toggle');
  expect(scheduleEntries().map(e => e.name)).toEqual(['morning', 'evening', 'weekly_review', 'export', 'restore_drill', 'push_summary']);
});
