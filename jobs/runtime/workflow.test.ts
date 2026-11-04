import test from 'node:test';
import { z } from 'zod';
import assert from 'node:assert/strict';
import { continueJob, defineJob, startJob } from './index.ts';
import type { Env, JobRecord, JobStore } from './index.ts';
import { forgetKinds } from './define.ts';
import { fakeWorkflows } from './workflow.fake.ts';
import { cloudflareAdapter, runJob, workflowExecutor } from './index.ts';
import type { Ceilings, StepHandlers } from './index.ts';

const T = '2026-11-03T12:00:00Z';
const parse = z.unknown();
function memory(): JobStore {
  const rows = new Map<string, JobRecord>();
  return {
    get: async (id) => rows.get(id),
    list: async () => [...rows.values()],
    put: async (r) => {
      if ((rows.get(r.id)?.v ?? 0) + 1 !== r.v) return false;
      rows.set(r.id, r);
      return true;
    },
  };
}

function setup(handlers: StepHandlers, ceil?: Partial<Ceilings>) {
  forgetKinds();
  const def = defineJob({
    kind: 'study_plan',
    title: 'Study plan',
    input: parse,
    output: parse,
    model: 'plan',
    maxTokens: 1000,
    costCapCents: 50,
    steps: ['plan', 'call', 'approve', 'save'],
    startedBy: ['matt'],
    executor: 'workflow',
    wording: { running: 'a', needsYou: 'b', done: 'c', failed: 'd' },
  });
  const store = memory();
  const usage = new Map<string, number>();
  const ceilings: Ceilings = {
    reserve: async () => {},
    record: async (k, _j, c) => void usage.set(k, c),
    ...ceil,
  };
  const wf = fakeWorkflows((step, p) => runJob({ store, ceilings, now: () => T }, step, def, handlers, p));
  let n = 0;
  const env: Env = {
    store,
    executors: { workflow: workflowExecutor(wf.adapter, def.kind) },
    now: () => T,
    newId: () => `j${++n}`,
  };
  return { def, env, store, wf, usage };
}

test('needs-you ends the instance; one continuation, repeated, saves once', async () => {
  const saved: unknown[] = [];
  const h: StepHandlers = {
    plan: async () => ({ ids: ['p1'] }),
    call: async (c) => (await c.spend(7), { ids: ['draft1'] }),
    approve: async () => ({ needsYou: 'Approve the plan.' }),
    save: async (c) => (saved.push(c.input), { ids: ['plan-1'] }),
  };
  const { def, env, store, wf, usage } = setup(h);
  await startJob(env, def, {}, 'matt');
  await wf.idle();
  const waiting = (await store.get('j1'))!;
  assert.equal(waiting.state, 'needs-you');
  assert.equal(waiting.step, 'approve');
  assert.equal(saved.length, 0);
  assert.deepEqual([...usage.keys()], ['j1:call:1']);
  assert.equal(waiting.costCents, 7); // the job record shows the spend, not only the ceilings

  await continueJob(env, def, 'j1', 'yes');
  await assert.rejects(continueJob(env, def, 'j1', 'yes'), /not waiting/);
  // even a direct second start of the same continuation id is a no-op
  await env.executors.workflow!.start('j1:approve', (await store.get('j1'))!, 'yes');
  await wf.idle();
  assert.deepEqual(saved, ['yes']);
  const done = (await store.get('j1'))!;
  assert.equal(done.state, 'done');
  assert.deepEqual(done.output, { home: 'library', id: 'plan-1' });
});

test('retry policy is the only retry: a flaky step retries with a new attempt; usage keyed per attempt', async () => {
  let calls = 0;
  const h: StepHandlers = {
    plan: async () => ({ ids: ['p'] }),
    call: async (c) => {
      calls++;
      await c.spend(3);
      if (c.attempt < 3) throw new Error('503');
      return { ids: ['d'] };
    },
    approve: async () => ({ needsYou: 'Approve.' }),
    save: async () => ({ ids: ['x'] }),
  };
  const { def, env, wf, usage } = setup(h);
  await startJob(env, def, {}, 'matt');
  await wf.idle();
  assert.equal(calls, 3);
  assert.deepEqual([...usage.keys()], ['j1:call:1', 'j1:call:2', 'j1:call:3']);
});

test('a ceiling hit or exhausted retries fails the job cleanly; content in a step result is refused', async () => {
  const ok = {
    plan: async () => ({ ids: ['p'] }),
    approve: async () => ({ needsYou: 'x' }),
    save: async () => ({ ids: ['x'] }),
  };
  let s = setup(
    { ...ok, call: async (c) => (await c.reserve(99), { ids: ['d'] }) },
    {
      reserve: async () => {
        throw new Error('The hourly ceiling is reached.');
      },
    },
  );
  await startJob(s.env, s.def, {}, 'matt');
  await s.wf.idle();
  let r = (await s.store.get('j1'))!;
  assert.equal(r.state, 'failed');
  assert.match(r.reason!, /hourly ceiling/);

  s = setup({ ...ok, call: async () => ({ ids: ['x'.repeat(500)] }) });
  await startJob(s.env, s.def, {}, 'matt');
  await s.wf.idle();
  r = (await s.store.get('j1'))!;
  assert.equal(r.state, 'failed');
  assert.match(r.reason!, /ids, never content/);
});

test('cloudflareAdapter turns a repeated instance id into exists', async () => {
  const seen = new Set<string>();
  const a = cloudflareAdapter({
    create: async ({ id }) => {
      if (seen.has(id)) throw new Error('instance.already_exists');
      seen.add(id);
    },
  });
  const p = { jobId: 'j', kind: 'k', input: null };
  assert.equal(await a.create('j:approve', p), 'created');
  assert.equal(await a.create('j:approve', p), 'exists');
});
