// Executors (CONTRACT §job.executors): a Workflow runs model jobs, a cron runs scheduled commands, a Mac session reports
// the Canvas sync through report_job. All share the one job record, so the fallback (Durable Object or Queues) is another Executor.
import type { ExecutorKind, JobDef, Starter } from './define.ts';
import { newJob, transition, update, type JobRecord, type JobStore, type OutputLocation } from './record.ts';

export interface Executor {
  kind: ExecutorKind;
  /** Starts the run under `instanceId`; starting the same id twice must be a no-op (idempotent). */
  start(instanceId: string, job: JobRecord, input: unknown): Promise<void>;
}

/** A continuation after "needs you" runs under `jobId:step`, so a repeated answer cannot start two. */
export const continuationId = (jobId: string, step: string): string => `${jobId}:${step}`;

export type Env = {
  store: JobStore;
  executors: Partial<Record<ExecutorKind, Executor>>;
  now: () => string;
  newId: () => string;
};

export async function startJob<I>(env: Env, def: JobDef<I>, rawInput: unknown, by: Starter): Promise<JobRecord> {
  if (!def.startedBy.includes(by)) throw new Error(`${def.title} cannot be started by ${by}`);
  const input = def.input(rawInput);
  const ex = env.executors[def.executor];
  if (!ex) throw new Error(`no ${def.executor} executor for ${def.kind}`);
  const rec = newJob({
    id: env.newId(),
    kind: def.kind,
    title: def.title,
    at: env.now(),
  });
  if (!(await env.store.put(rec))) throw new Error(`job ${rec.id}: id already exists`);
  try {
    await ex.start(rec.id, rec, input);
  } catch (e) {
    return update(env.store, rec.id, (r) =>
      transition(r, {
        to: 'failed',
        at: env.now(),
        reason: `Could not start: ${(e as Error).message}`,
      }),
    );
  }
  return rec;
}

/** Matt's answer at a needs-you step: back to running and a continuation instance, once. */
export async function continueJob(env: Env, def: JobDef, jobId: string, answer: unknown): Promise<JobRecord> {
  const cur = await env.store.get(jobId);
  if (!cur || cur.state !== 'needs-you' || !cur.step) throw new Error(`job ${jobId} is not waiting for you`);
  const ex = env.executors[def.executor];
  if (!ex) throw new Error(`no ${def.executor} executor for ${def.kind}`);
  const step = cur.step;
  const next = await update(env.store, jobId, (r) => transition(r, { to: 'running', at: env.now() }));
  await ex.start(continuationId(jobId, step), next, answer);
  return next;
}

export type Report =
  | { jobId: string; state: 'running' }
  | { jobId: string; state: 'needs-you'; step: string; reason: string }
  | { jobId: string; state: 'done'; output: OutputLocation }
  | { jobId: string; state: 'failed'; reason: string };

/** report_job: how the Mac session (and any executor outside the Worker) moves the same record. */
export function reportJob(env: Env, r: Report): Promise<JobRecord> {
  const at = env.now();
  return update(env.store, r.jobId, (rec) =>
    transition(rec, {
      to: r.state,
      at,
      ...('reason' in r ? { reason: r.reason } : {}),
      ...('step' in r ? { step: r.step } : {}),
      ...('output' in r ? { output: r.output } : {}),
    }),
  );
}
