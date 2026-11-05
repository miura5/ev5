// The Workflows runtime (CONTRACT §job.steps, §job.needs-you). Cloudflare's binding sits behind WorkflowAdapter so tests run
// on an in-memory fake. A step returns ids, never content; the step's retry policy is the only retry layer (the Anthropic
// SDK runs with maxRetries: 0); "needs you" ends the instance and Matt's answer starts a continuation `jobId-step-round`.
import type { JobDef } from './define.ts';
import { continuationId, type Executor } from './executors.ts';
import { addCost, transition, update, type JobStore } from './record.ts';

export type StepConfig = {
  retries: {
    limit: number;
    delay: string;
    backoff: 'constant' | 'linear' | 'exponential';
  };
  timeout: string;
};
/** The one retry policy; nothing else in the runtime retries. */
export const STEP_RETRY: StepConfig = {
  retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' },
  timeout: '5 minutes',
};

/** The part of Cloudflare's WorkflowStep the runtime uses. `attempt` is 1-based. */
export interface StepRunner {
  do<T>(name: string, config: StepConfig, fn: (c: { attempt: number }) => Promise<T>): Promise<T>;
}

export type InstanceParams = {
  jobId: string;
  kind: string;
  from?: string;
  /** With `from`: the round (job record version) that makes the continuation's instance id new. */
  round?: number;
  input: unknown;
};

/** The part of a Workflow binding the runtime uses; `create` of an id that exists answers 'exists'. */
export interface WorkflowAdapter {
  create(id: string, params: InstanceParams): Promise<'created' | 'exists'>;
}

/** Cloudflare binding to adapter: the platform refuses a repeated instance id by throwing. */
export function cloudflareAdapter(binding: {
  create(o: { id: string; params: InstanceParams }): Promise<unknown>;
}): WorkflowAdapter {
  return {
    create: async (id, params) => {
      try {
        await binding.create({ id, params });
        return 'created';
      } catch (e) {
        if (/already[_ .]exist/i.test((e as Error).message)) return 'exists';
        throw e;
      }
    },
  };
}

/** The workflow Executor (§job.executors): starting an id twice is a no-op. */
export function workflowExecutor(wf: WorkflowAdapter, kind: string): Executor {
  return {
    kind: 'workflow',
    start: async (id, job, input, cont) => {
      await wf.create(id, {
        jobId: job.id,
        kind,
        input,
        ...(cont ? { from: cont.from, round: cont.round } : {}),
      });
    },
  };
}

/** Ceilings arrive through this interface; every call reserves its maximum first, usage is keyed so it counts once. */
export interface Ceilings {
  reserve(jobId: string, maxCents: number): Promise<void>;
  record(key: string, jobId: string, cents: number): Promise<void>;
}

export type StepResult = { ids: string[] } | { needsYou: string };
export type StepCtx = {
  jobId: string;
  instanceId: string;
  step: string;
  attempt: number;
  /** The job input, or Matt's answer in a continuation. */
  input: unknown;
  /** Ids returned by earlier steps of this instance. */
  prior: Readonly<Record<string, readonly string[]>>;
  reserve(maxCents: number): Promise<void>;
  /** Usage keyed by instance, step and attempt. */
  spend(cents: number): Promise<void>;
};
export type StepHandlers = Record<string, (c: StepCtx) => Promise<StepResult>>;

export type RunEnv = { store: JobStore; ceilings: Ceilings; now: () => string };

const MAX_IDS = 200;
function checkIds(step: string, ids: string[]): void {
  if (ids.length > MAX_IDS || ids.some((i) => typeof i !== 'string' || i.length > 128))
    throw new Error(`step ${step} must return ids, never content`);
}

/** The Workflow entrypoint body. Returns when the job is done, failed or waiting for Matt (the instance then ends). */
export async function runJob(
  env: RunEnv,
  step: StepRunner,
  def: JobDef,
  handlers: StepHandlers,
  p: InstanceParams,
): Promise<void> {
  const instanceId = p.from ? continuationId(p.jobId, p.from, p.round ?? 0) : p.jobId;
  const names = p.from ? def.steps.slice(def.steps.indexOf(p.from) + 1) : def.steps;
  if (p.from && !def.steps.includes(p.from)) throw new Error(`${def.kind} has no step ${p.from}`);
  // A stopped, swept or replaced job is no longer running: nothing more of this instance may land under it.
  const stillRunning = async () => (await env.store.get(p.jobId))?.state === 'running';
  const move = (name: string, to: Parameters<typeof transition>[1]) =>
    step.do(name, STEP_RETRY, async () => {
      const cur = await env.store.get(p.jobId);
      if (cur?.state === to.to) return cur.id;
      if (!cur || (name !== 'begin' && cur.state !== 'running')) return p.jobId;
      return (await update(env.store, p.jobId, (r) => transition(r, to))).id;
    });
  const fail = (reason: string) => move('fail', { to: 'failed', at: env.now(), reason });
  if (!p.from) {
    const first = await env.store.get(p.jobId);
    if (first && first.state !== 'queued' && first.state !== 'running') return;
    await move('begin', { to: 'running', at: env.now() });
  }
  const prior: Record<string, string[]> = {};
  for (const name of names) {
    const run = async (c: { attempt: number }): Promise<StepResult | { stopped: true }> => {
      if (!(await stillRunning())) return { stopped: true };
      const ctx: StepCtx = {
        jobId: p.jobId,
        instanceId,
        step: name,
        attempt: c.attempt,
        input: p.input,
        prior,
        reserve: (cents) => env.ceilings.reserve(p.jobId, cents),
        spend: async (cents) => {
          await env.ceilings.record(`${instanceId}:${name}:${c.attempt}`, p.jobId, cents);
          // The job record shows what the job cost (it stayed 0 because only the ceilings were told).
          await update(env.store, p.jobId, (r) => addCost(r, cents, env.now()));
        },
      };
      const r = await handlers[name]!(ctx);
      if ('ids' in r) checkIds(name, r.ids);
      return r;
    };
    let r: StepResult | { stopped: true };
    try {
      r = await step.do(name, STEP_RETRY, run);
    } catch (e) {
      await fail(`${def.title} stopped at ${name}: ${(e as Error).message}`);
      return;
    }
    if ('stopped' in r) return;
    if ('needsYou' in r) {
      await move(`needs-you:${name}`, {
        to: 'needs-you',
        at: env.now(),
        step: name,
        reason: r.needsYou,
      });
      return;
    }
    prior[name] = r.ids;
  }
  const out = prior[names[names.length - 1]!]?.[0];
  if (!out) return void (await fail(`${def.title} finished without saying where its output went.`));
  await move('done', {
    to: 'done',
    at: env.now(),
    output: { home: 'library', id: out },
  });
}
