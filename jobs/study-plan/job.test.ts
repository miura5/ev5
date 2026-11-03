import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { continueJob, startJob } from '../runtime/index.ts';
import type { Env, JobRecord, JobStore, Ceilings } from '../runtime/index.ts';
import { cloudflareAdapter, runJob, workflowExecutor } from '../runtime/index.ts';
import { fakeWorkflows } from '../runtime/workflow.fake.ts';
import type { ModelCall, ModelReply, ModelRequest } from '../runtime/output.ts';
import { buildContext, checkPlan, parseDecision, parsePlan, studyPlanHandlers, studyPlanJob } from './job.ts';
import type { Plan, PlanContext, PlanStore } from './job.ts';
import { askChanges } from './changes.ts';

const T = '2026-11-03T12:00:00Z';
const exam = {
  id: 'e1',
  schema: 2 as const,
  writer: 'page' as const,
  at: T,
  source: 't',
  title: 'Unit 3',
  kind: 'unit' as const,
  date: '2026-11-08',
};
const spots = [
  { id: 'w1', title: 'Heparin', need: 1 },
  { id: 'w2', title: 'Insulin', need: 2 },
];
const good: Plan = {
  summary: 'Insulin first, then heparin.',
  tasks: [
    { date: '2026-11-03', title: 'Insulin', minutes: 30, weakSpotId: 'w2' },
    { date: '2026-11-07', title: 'Light review', minutes: 20 },
  ],
};
const reply = (p: unknown): ModelReply => ({
  stopReason: 'end_turn',
  text: JSON.stringify(p),
  usage: { inputTokens: 1000, outputTokens: 500 },
});

function memStore(over: { exam?: typeof exam | undefined } = {}) {
  const rows = new Map<string, unknown>();
  const log: string[] = [];
  const store: PlanStore = {
    load: async () =>
      'exam' in over
        ? over.exam && { exam: over.exam, spots, today: '2026-11-03' }
        : { exam, spots, today: '2026-11-03' },
    putContext: async (j, c) => (rows.set(`c${j}`, c), `ctx-${j}`),
    getContext: async (j) => rows.get(`c${j}`) as PlanContext,
    putDraft: async (j, p) => (rows.set(`d${j}`, p), `draft-${j}`),
    getDraft: async (j) => rows.get(`d${j}`) as Plan,
    putFailure: async (j, r) => void rows.set(`f${j}`, r),
    getFailure: async (j) => rows.get(`f${j}`) as string | undefined,
    approve: async (j, p) => (log.push(`approve ${p.tasks.length}`), `plan-${j}`),
    putAway: async (j) => (log.push('put away'), `away-${j}`),
  };
  return { store, log, rows };
}

function setup(call: ModelCall, over?: Parameters<typeof memStore>[0]) {
  const { store, log, rows: planRows } = memStore(over);
  const rows = new Map<string, JobRecord>();
  const jobs: JobStore = {
    get: async (id) => rows.get(id),
    list: async () => [...rows.values()],
    put: async (r) => {
      if ((rows.get(r.id)?.v ?? 0) + 1 !== r.v) return false;
      rows.set(r.id, r);
      return true;
    },
  };
  const spent: number[] = [];
  const ceilings: Ceilings = {
    reserve: async () => {},
    record: async (_k, _j, c) => void spent.push(c),
  };
  const handlers = studyPlanHandlers({
    store,
    call,
    system: 'sys',
    changesSystem: 'chg',
    askChanges,
  });
  const wf = fakeWorkflows((step, p) =>
    runJob({ store: jobs, ceilings, now: () => T }, step, studyPlanJob, handlers, p),
  );
  let n = 0;
  const env: Env = {
    store: jobs,
    executors: { workflow: workflowExecutor(wf.adapter, 'study_plan') },
    now: () => T,
    newId: () => `j${++n}`,
  };
  return { env, jobs, wf, log, spent, planRows };
}

test('only Matt can start it, never a schedule or the Mac', async () => {
  const { env } = setup(async () => reply(good));
  await assert.rejects(startJob(env, studyPlanJob, { examId: 'e1' }, 'schedule'), /cannot be started/);
  await assert.rejects(startJob(env, studyPlanJob, { examId: 'e1' }, 'mac'), /cannot be started/);
});

test('tap, draft, needs you, approve once, tasks go to Today', async () => {
  const reqs: ModelRequest[] = [];
  const { env, jobs, wf, log, spent } = setup(async (r) => (reqs.push(r), reply(good)));
  const job = await startJob(env, studyPlanJob, { examId: 'e1' }, 'matt');
  await wf.idle();
  const waiting = (await jobs.get(job.id))!;
  assert.equal(waiting.state, 'needs-you');
  assert.equal(waiting.step, 'approve');
  assert.match(waiting.reason!, /Unit 3/);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0]!.model, 'sonnet');
  assert.equal(spent.length, 1);
  await continueJob(env, studyPlanJob, job.id, { decision: 'approve' });
  await continueJob(env, studyPlanJob, job.id, { decision: 'approve' }).catch(() => {});
  await wf.idle();
  const done = (await jobs.get(job.id))!;
  assert.equal(done.state, 'done');
  assert.deepEqual(log, ['approve 2']);
  assert.equal(reqs.length, 1);
});

test('a change request on the draft calls Haiku, stores the patched draft, then approve saves it', async () => {
  const reqs: ModelRequest[] = [];
  const { env, jobs, wf, log, planRows } = setup(async (r) => {
    reqs.push(r);
    return r.model === 'haiku' ? reply({ summary: 'Lighter.', ops: [{ op: 'remove', task: 2 }] }) : reply(good);
  });
  const job = await startJob(env, studyPlanJob, { examId: 'e1' }, 'matt');
  await wf.idle();
  await continueJob(env, studyPlanJob, job.id, {
    decision: 'change',
    note: 'drop the light review',
  });
  await wf.idle();
  const waiting = (await jobs.get(job.id))!;
  assert.equal(waiting.state, 'needs-you');
  assert.match(waiting.reason!, /was changed/);
  assert.deepEqual(
    reqs.map((r) => r.model),
    ['sonnet', 'haiku'],
  );
  const d = planRows.get(`d${job.id}`) as Plan;
  assert.equal(d.summary, 'Lighter.');
  assert.equal(d.tasks.length, 1);
  await continueJob(env, studyPlanJob, job.id, { decision: 'approve' });
  await wf.idle();
  assert.equal((await jobs.get(job.id))!.state, 'done');
  assert.deepEqual(log, ['approve 1']);
});

test('put away keeps the draft and approves nothing', async () => {
  const { env, jobs, wf, log } = setup(async () => reply(good));
  const job = await startJob(env, studyPlanJob, { examId: 'e1' }, 'matt');
  await wf.idle();
  await continueJob(env, studyPlanJob, job.id, { decision: 'put_away' });
  await wf.idle();
  assert.equal((await jobs.get(job.id))!.state, 'done');
  assert.deepEqual(log, ['put away']);
});

test('an undated exam fails in plain words with no model call', async () => {
  let calls = 0;
  const { env, jobs, wf } = setup(async () => (calls++, reply(good)), {
    exam: { ...exam, date: null } as never,
  });
  const job = await startJob(env, studyPlanJob, { examId: 'e1' }, 'matt');
  await wf.idle();
  const r = (await jobs.get(job.id))!;
  assert.equal(r.state, 'failed');
  assert.match(r.reason!, /no date yet/);
  assert.equal(calls, 0);
});

test('a plan citing an unknown weak spot gets one repair ask, then fails without paying for step retries', async () => {
  let calls = 0;
  const bad = {
    ...good,
    tasks: [{ date: '2026-11-03', title: 'x', minutes: 30, weakSpotId: 'nope' }],
  };
  const { env, jobs, wf, spent } = setup(async () => (calls++, reply(bad)));
  const job = await startJob(env, studyPlanJob, { examId: 'e1' }, 'matt');
  await wf.idle();
  const r = (await jobs.get(job.id))!;
  assert.equal(r.state, 'failed');
  assert.match(r.reason!, /nope/);
  assert.equal(calls, 2);
  assert.equal(spent.length, 1);
});

test('buildContext: days stop the day before the exam, worst weak spot first', () => {
  const ctx = buildContext({ exam, spots, today: '2026-11-03' });
  assert.deepEqual(ctx.days, ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  assert.deepEqual(
    ctx.weakSpots.map((w) => w.id),
    ['w2', 'w1'],
  );
  assert.equal(
    buildContext({
      exam: { ...exam, date: '2027-03-01' },
      spots,
      today: '2026-11-03',
    }).days.length,
    28,
  );
  assert.throws(
    () =>
      buildContext({
        exam: { ...exam, date: '2026-11-03' },
        spots,
        today: '2026-11-03',
      }),
    /today or past/,
  );
});

test('checkPlan: window, daily cap and citations', () => {
  const ctx = buildContext({ exam, spots, today: '2026-11-03' });
  assert.deepEqual(checkPlan(good, ctx), []);
  const t = (date: string, minutes: number) => ({ date, title: 'a', minutes });
  assert.match(checkPlan({ summary: 's', tasks: [t('2026-11-08', 30)] }, ctx).join(), /not study days/);
  assert.match(
    checkPlan({ summary: 's', tasks: [t('2026-11-04', 120), t('2026-11-04', 90)] }, ctx).join(),
    /210 minutes/,
  );
  assert.match(checkPlan({ summary: 's', tasks: [] }, ctx).join(), /no tasks/);
});

test('parsers refuse bad shapes; ask_changes is not offered yet', () => {
  assert.throws(
    () =>
      parsePlan({
        summary: 's',
        tasks: [{ date: 'x', title: 't', minutes: 30 }],
      }),
    /bad date/,
  );
  assert.throws(
    () =>
      parsePlan({
        summary: 's',
        tasks: [{ date: '2026-11-03', title: 't', minutes: 5 }],
      }),
    /minutes/,
  );
  assert.throws(() => parseDecision({ decision: 'ask_changes' }), /approve or put_away/);
  assert.deepEqual(parseDecision({ decision: 'approve' }), {
    decision: 'approve',
  });
});

test('prompt.md exists and names the reply fields', () => {
  const p = fs.readFileSync(new URL('./prompt.md', import.meta.url), 'utf8');
  for (const w of ['summary', 'tasks', 'weakSpotId', 'days']) assert.ok(p.includes(w), w);
});
