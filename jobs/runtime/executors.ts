// Executors (CONTRACT §job.executors): a Workflow runs model jobs, a cron runs scheduled commands, a Mac session reports
// the Canvas sync through report_job. All share the one job record, so the fallback (Durable Object or Queues) is another Executor.
import type { ExecutorKind, JobDef, Starter } from './define.ts';
import { newJob, transition, update, type JobRecord, type JobStore, type OutputLocation } from './record.ts';

export interface Executor {
  kind: ExecutorKind;
  /** Starts the run under `instanceId`; starting the same id twice must be a no-op (idempotent). */
  start(instanceId: string, job: JobRecord, input: unknown, cont?: Continuation): Promise<void>;
}

/** Where a continuation resumes: after `from`, in the round `round` (the job record's version after the answer). */
export type Continuation = { from: string; round: number };

/** Cloudflare Workflows: an instance id is 1 to 100 characters of letters, digits, `-` and `_`, not starting with `-`. */
const INSTANCE_ID = /^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,99}$/;

/**
 * A continuation after "needs you" runs under `jobId-step-round`. The round is the record version, new at every
 * answer, so a second answer at the same step gets a new instance and new spend keys; a repeated answer cannot
 * start two because only the needs-you to running move starts one.
 */
export function continuationId(jobId: string, step: string, round: number): string {
  const id = `${jobId}-${step}-${round}`;
  if (!INSTANCE_ID.test(id)) throw new Error(`continuation id "${id}" is not a valid Workflow instance id`);
  return id;
}

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
    id: `job_${env.newId()}`,
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
  // A bad answer is refused before anything moves: the job stays waiting for a better one.
  def.answer?.(answer);
  const step = cur.step;
  const next = await update(env.store, jobId, (r) => transition(r, { to: 'running', at: env.now() }));
  const round = next.v;
  try {
    await ex.start(continuationId(jobId, step, round), next, answer, {
      from: step,
      round,
    });
  } catch (e) {
    // No instance is running, so the job goes back to waiting where it was instead of sitting in running.
    await update(env.store, jobId, (r) =>
      transition(r, { to: 'needs-you', at: env.now(), step, reason: cur.reason ?? 'Waiting for your answer.' }),
    ).catch(() => undefined);
    throw e;
  }
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
