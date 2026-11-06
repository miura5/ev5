import test from 'node:test';
import { z } from 'zod';
import assert from 'node:assert/strict';
import { continuationId, continueJob, defineJob, startJob } from './index.ts';
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

function setup(handlers: StepHandlers, ceil?: Partial<Ceilings>, answer?: (raw: unknown) => unknown) {
  forgetKinds();
  const def = defineJob({
    kind: 'prep_plan',
    title: 'Prep plan',
    input: parse,
    output: parse,
    model: 'plan',
    maxTokens: 1000,
    costCapCents: 50,
    steps: ['plan', 'call', 'approve', 'save'],
    startedBy: ['matt'],
    executor: 'workflow',
    ...(answer ? { answer } : {}),
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
  const waiting = (await store.get('job_j1'))!;
  assert.equal(waiting.state, 'needs-you');
  assert.equal(waiting.step, 'approve');
  assert.equal(saved.length, 0);
  assert.deepEqual([...usage.keys()], ['job_j1:call:1']);
  assert.equal(waiting.costCents, 7); // the job record shows the spend, not only the ceilings

  const running = await continueJob(env, def, 'job_j1', 'yes');
  await assert.rejects(continueJob(env, def, 'job_j1', 'yes'), /not waiting/);
  // even a direct second start of the same continuation id is a no-op
  await env.executors.workflow!.start(continuationId('job_j1', 'approve', running.v), running, 'yes', {
    from: 'approve',
    round: running.v,
  });
  await wf.idle();
  assert.deepEqual(saved, ['yes']);
  const done = (await store.get('job_j1'))!;
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
  assert.deepEqual([...usage.keys()], ['job_j1:call:1', 'job_j1:call:2', 'job_j1:call:3']);
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
  let r = (await s.store.get('job_j1'))!;
  assert.equal(r.state, 'failed');
  assert.match(r.reason!, /hourly ceiling/);

  s = setup({ ...ok, call: async () => ({ ids: ['x'.repeat(500)] }) });
  await startJob(s.env, s.def, {}, 'matt');
  await s.wf.idle();
  r = (await s.store.get('job_j1'))!;
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

test('two rounds at the same step get different valid instance ids and spend keys', async () => {
  const h: StepHandlers = {
    plan: async () => ({ ids: ['p'] }),
    call: async (c) => (await c.spend(2), { ids: ['d'] }),
    approve: async () => ({ needsYou: 'Approve.' }),
    save: async () => ({ ids: ['x'] }),
  };
  const { def, env, store, wf, usage } = setup(h);
  await startJob(env, def, {}, 'matt');
  await wf.idle();
  for (const from of ['plan', 'plan']) {
    // an answer at a step that waits again: the job goes back to needs-you at `approve`, then is answered again
    const cur = (await store.get('job_j1'))!;
    const r = cur.v + 1;
    const next = { ...cur, state: 'running' as const, v: r };
    delete next.step;
    await store.put(next);
    await env.executors.workflow!.start(continuationId('job_j1', from, r), next, 'a', { from, round: r });
    await wf.idle();
  }
  const keys = [...usage.keys()];
  assert.equal(keys.length, 3);
  assert.equal(new Set(keys).size, 3);
  for (const k of keys) assert.match(k.split(':')[0]!, /^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,99}$/);
});

test('a job that is no longer running stops: no later step runs and nothing lands under it', async () => {
  const ran: string[] = [];
  let store!: JobStore;
  const h: StepHandlers = {
    plan: async () => (ran.push('plan'), { ids: ['p'] }),
    call: async () => {
      ran.push('call');
      const cur = (await store.get('job_j1'))!;
      // the sweep (or a replacing plan) fails the job while this step is working
      await store.put({ ...cur, state: 'failed', reason: 'Swept.', v: cur.v + 1 });
      return { ids: ['d'] };
    },
    approve: async () => (ran.push('approve'), { needsYou: 'Approve.' }),
    save: async () => (ran.push('save'), { ids: ['x'] }),
  };
  const s = setup(h);
  store = s.store;
  await startJob(s.env, s.def, {}, 'matt');
  await s.wf.idle();
  assert.deepEqual(ran, ['plan', 'call']);
  const r = (await s.store.get('job_j1'))!;
  assert.equal(r.state, 'failed');
  assert.equal(r.reason, 'Swept.');
});

test('a job that failed before it began is not started', async () => {
  const ran: string[] = [];
  const s = setup({ plan: async () => (ran.push('plan'), { ids: ['p'] }) });
  await s.store.put({
    id: 'j9',
    kind: 'prep_plan',
    title: 'Prep plan',
    state: 'failed',
    reason: 'Gone.',
    costCents: 0,
    createdAt: T,
    updatedAt: T,
    v: 1,
  });
  await s.env.executors.workflow!.start('j9', (await s.store.get('j9'))!, {});
  await s.wf.idle();
  assert.deepEqual(ran, []);
  assert.equal((await s.store.get('j9'))!.state, 'failed');
});

const waiting = {
  plan: async () => ({ ids: ['p'] }),
  call: async () => ({ ids: ['d'] }),
  approve: async () => ({ needsYou: 'Approve the plan.' }),
  save: async () => ({ ids: ['plan-1'] }),
};

test('a bad answer is refused before the move: the job stays waiting and a good answer still works', async () => {
  const check = (raw: unknown) => {
    if (raw !== 'yes') throw new Error('Answer yes.');
    return raw;
  };
  const { def, env, store, wf } = setup(waiting, undefined, check);
  await startJob(env, def, {}, 'matt');
  await wf.idle();
  const before = (await store.get('job_j1'))!;
  await assert.rejects(continueJob(env, def, 'job_j1', 'nope'), /Answer yes/);
  assert.deepEqual(await store.get('job_j1'), before);
  await continueJob(env, def, 'job_j1', 'yes');
  await wf.idle();
  assert.equal((await store.get('job_j1'))!.state, 'done');
});

test('a Workflow that fails to start puts the job back to waiting, then a retry works', async () => {
  const { def, env, store, wf } = setup(waiting);
  await startJob(env, def, {}, 'matt');
  await wf.idle();
  const before = (await store.get('job_j1'))!;
  const real = env.executors.workflow!;
  env.executors.workflow = {
    kind: 'workflow',
    start: async () => {
      throw new Error('binding down');
    },
  };
  await assert.rejects(continueJob(env, def, 'job_j1', 'yes'), /binding down/);
  const back = (await store.get('job_j1'))!;
  assert.equal(back.state, 'needs-you');
  assert.equal(back.step, before.step);
  assert.equal(back.reason, before.reason);
  env.executors.workflow = real;
  await continueJob(env, def, 'job_j1', 'yes');
  await wf.idle();
  assert.equal((await store.get('job_j1'))!.state, 'done');
});
