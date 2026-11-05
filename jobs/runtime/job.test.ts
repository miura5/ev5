import test from 'node:test';
import { z } from 'zod';
import assert from 'node:assert/strict';
import {
  addCost,
  continuationId,
  continueJob,
  defineJob,
  jobStatus,
  newJob,
  reportJob,
  startJob,
  transition,
} from './index.ts';
import type { Env, Executor, JobRecord, JobStore } from './index.ts';
import { forgetKinds } from './define.ts';

const T = '2026-11-03T12:00:00Z';
const parse = z.unknown();
const spec = (kind = 'practice_set') => ({
  kind,
  title: 'Practice set',
  input: parse,
  output: parse,
  model: 'practice',
  maxTokens: 32000,
  costCapCents: 50,
  steps: ['plan', 'call', 'save'],
  startedBy: ['matt'] as const,
  executor: 'workflow' as const,
  wording: {
    running: 'Writing your set.',
    needsYou: 'Some items have no source.',
    done: 'Your set is ready.',
    failed: 'The set did not finish.',
  },
});

function memory(): JobStore & { rows: Map<string, JobRecord> } {
  const rows = new Map<string, JobRecord>();
  return {
    rows,
    get: async (id) => rows.get(id),
    list: async () => [...rows.values()],
    put: async (r) => {
      const cur = rows.get(r.id);
      if ((cur?.v ?? 0) + 1 !== r.v) return false;
      rows.set(r.id, r);
      return true;
    },
  };
}
function env() {
  const store = memory();
  const started: string[] = [];
  const workflow: Executor = {
    kind: 'workflow',
    start: async (id) => void started.push(id),
  };
  let n = 0;
  return {
    store,
    started,
    e: {
      store,
      executors: { workflow },
      now: () => T,
      newId: () => `j${++n}`,
    } as Env,
  };
}

test('lifecycle: queued → running → needs-you → running → done', () => {
  let r = newJob({ id: 'j', kind: 'k', title: 'K', at: T });
  r = transition(r, { to: 'running', at: T });
  r = transition(r, {
    to: 'needs-you',
    at: T,
    step: 'approve',
    reason: 'Approve the plan.',
  });
  assert.equal(r.step, 'approve');
  assert.equal(r.needsYouAt, T);
  r = transition(r, { to: 'running', at: T });
  assert.equal(r.reason, undefined);
  r = transition(r, {
    to: 'done',
    at: T,
    output: { home: 'library', id: 's1' },
  });
  assert.equal(r.state, 'done');
  assert.equal(r.v, 5);
});

test('illegal moves and missing reasons are refused', () => {
  const q = newJob({ id: 'j', kind: 'k', title: 'K', at: T });
  assert.throws(
    () =>
      transition(q, {
        to: 'done',
        at: T,
        output: { home: 'library', id: 'x' },
      }),
    /cannot go/,
  );
  const run = transition(q, { to: 'running', at: T });
  assert.throws(() => transition(run, { to: 'failed', at: T }), /reason/);
  assert.throws(() => transition(run, { to: 'needs-you', at: T, reason: 'x' }), /step/);
  assert.throws(() => transition(run, { to: 'done', at: T }), /output/);
  const failed = transition(run, {
    to: 'failed',
    at: T,
    reason: 'Ran out of budget.',
  });
  assert.throws(() => transition(failed, { to: 'running', at: T }), /cannot go/);
});

test('cost adds up and rejects bad numbers', () => {
  let r = newJob({ id: 'j', kind: 'k', title: 'K', at: T });
  r = addCost(addCost(r, 3, T), 4, T);
  assert.equal(r.costCents, 7);
  assert.throws(() => addCost(r, -1, T), /cost/);
  assert.throws(() => addCost(r, NaN, T), /cost/);
});

test('defineJob validates and freezes', () => {
  forgetKinds();
  const d = defineJob(spec());
  assert.ok(Object.isFrozen(d));
  assert.throws(() => defineJob(spec()), /already defined/);
  assert.throws(() => defineJob({ ...spec('b'), steps: ['a:b'] }), /colon/);
  assert.throws(() => defineJob({ ...spec('c'), costCapCents: 0 }), /costCapCents/);
  assert.throws(() => defineJob({ ...spec('Bad Kind') }), /snake/);
  assert.throws(() => defineJob({ ...spec('d'), startedBy: [] }), /starter/);
});

test('startJob, continuation id, and idempotent needs-you', async () => {
  forgetKinds();
  const def = defineJob(spec());
  const { e, started, store } = env();
  assert.rejects(startJob(e, def, {}, 'schedule'), /cannot be started/);
  const j = await startJob(e, def, {}, 'matt');
  assert.deepEqual(started, ['j1']);
  await reportJob(e, { jobId: j.id, state: 'running' });
  await reportJob(e, {
    jobId: j.id,
    state: 'needs-you',
    step: 'approve',
    reason: 'Approve the plan.',
  });
  await continueJob(e, def, j.id, { ok: true });
  assert.deepEqual(started, ['j1', continuationId(j.id, 'approve', 4)]);
  assert.match(started[1]!, /^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,99}$/);
  assert.notEqual(continuationId(j.id, 'approve', 4), continuationId(j.id, 'approve', 6));
  assert.throws(() => continuationId('a:b', 'approve', 1), /valid Workflow instance id/);
  await assert.rejects(continueJob(e, def, j.id, {}), /not waiting/);
  assert.equal(store.rows.get(j.id)?.state, 'running');
});

test('a failed executor start fails the job with a reason', async () => {
  forgetKinds();
  const def = defineJob(spec());
  const { e } = env();
  e.executors.workflow = {
    kind: 'workflow',
    start: async () => {
      throw new Error('binding missing');
    },
  };
  const j = await startJob(e, def, {}, 'matt');
  assert.equal(j.state, 'failed');
  const [s] = await jobStatus(e.store, new Map(), j.id);
  assert.equal(s?.state, 'failed');
  assert.match(s!.summary, /binding missing/);
});

test('stale writes are refused', async () => {
  const { e } = env();
  const r = newJob({ id: 'x', kind: 'k', title: 'K', at: T });
  await e.store.put(r);
  assert.equal(await e.store.put(r), false);
});

test('job_status: plain words, links, no chat question', async () => {
  forgetKinds();
  const def = defineJob(spec());
  const defs = new Map([[def.kind, def]]);
  const { e } = env();
  const j = await startJob(e, def, {}, 'matt');
  await reportJob(e, { jobId: j.id, state: 'running' });
  await reportJob(e, {
    jobId: j.id,
    state: 'needs-you',
    step: 'approve',
    reason: 'Keep or drop 3 items.',
  });
  const [w] = await jobStatus(e.store, defs);
  assert.equal(w?.link.home, 'activity');
  assert.match(w!.summary, /Keep or drop 3 items\. It is waiting in Activity\./);
  assert.ok(!w!.summary.includes('?'));
  await reportJob(e, {
    jobId: j.id,
    state: 'failed',
    reason: 'Over the cost cap.',
  });
  assert.deepEqual(await jobStatus(e.store, defs), []);
  const [f] = await jobStatus(e.store, defs, j.id);
  assert.equal(f?.finished, true);
  assert.equal(f?.summary, 'The set did not finish. Over the cost cap.');
});

test('job_status: the reason is its own field, summary keeps it for E.V.', async () => {
  forgetKinds();
  const def = defineJob(spec());
  const defs = new Map([[def.kind, def]]);
  const { e } = env();
  const j = await startJob(e, def, {}, 'matt');
  const [q] = await jobStatus(e.store, defs, j.id);
  assert.equal(q?.reason, undefined);
  await reportJob(e, { jobId: j.id, state: 'running' });
  await reportJob(e, {
    jobId: j.id,
    state: 'needs-you',
    step: 'approve',
    reason: 'Keep or drop 3 items.',
  });
  const [w] = await jobStatus(e.store, defs, j.id);
  assert.equal(w?.reason, 'Keep or drop 3 items.');
  assert.ok(!w!.lead.includes('Keep or drop'));
  assert.ok(!w!.lead.includes('Activity'));
  await reportJob(e, {
    jobId: j.id,
    state: 'failed',
    reason: 'Over the cost cap.',
  });
  const [f] = await jobStatus(e.store, defs, j.id);
  assert.equal(f?.reason, 'Over the cost cap.');
  assert.equal(f?.lead, 'The set did not finish.');
});
