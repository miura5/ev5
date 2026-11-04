// job_status (CONTRACT §job.no-chat-ask): the one way E.V. reads a job. It returns state in plain words and where to look;
// it never carries a question for chat, because a job that needs Matt says so in Activity.
import { isTerminal, type JobRecord, type JobStore } from './record.ts';
import type { JobDef } from './define.ts';

export type JobStatus = {
  id: string;
  kind: string;
  state: JobRecord['state'];
  /** One plain sentence for E.V. to relay. */
  summary: string;
  /** The generic line alone (no reason, no pointer to Activity): what a one-line row shows. */
  lead: string;
  /** Why the job needs Matt or failed, as its own field; absent otherwise. `summary` still carries it for E.V. */
  reason?: string;
  costCents: number;
  /** Link target: the output's home when done, otherwise Activity. */
  link: { home: string; id: string };
  finished: boolean;
};

export function describe(rec: JobRecord, def?: JobDef): JobStatus {
  const w = def?.wording;
  const summary = {
    queued: `${rec.title} is waiting to start.`,
    running: w?.running ?? `${rec.title} is running.`,
    'needs-you': `${w?.needsYou ?? `${rec.title} needs you.`} ${rec.reason ?? ''} It is waiting in Activity.`
      .replace(/\s+/g, ' ')
      .trim(),
    done: w?.done ?? `${rec.title} is done.`,
    failed: `${w?.failed ?? `${rec.title} did not finish.`} ${rec.reason ?? ''}`.trim(),
  }[rec.state];
  const lead = {
    queued: `${rec.title} is waiting to start.`,
    running: w?.running ?? `${rec.title} is running.`,
    'needs-you': w?.needsYou ?? `${rec.title} needs you.`,
    done: w?.done ?? `${rec.title} is done.`,
    failed: w?.failed ?? `${rec.title} did not finish.`,
  }[rec.state];
  const reason = (rec.state === 'needs-you' || rec.state === 'failed') && rec.reason ? rec.reason : undefined;
  const link = rec.state === 'done' && rec.output ? rec.output : { home: 'activity', id: rec.id };
  return {
    id: rec.id,
    kind: rec.kind,
    state: rec.state,
    summary,
    lead,
    ...(reason ? { reason } : {}),
    costCents: rec.costCents,
    link,
    finished: isTerminal(rec.state),
  };
}

/** job_status: one job by id, or every job that has not finished. */
export async function jobStatus(store: JobStore, defs: ReadonlyMap<string, JobDef>, id?: string): Promise<JobStatus[]> {
  if (id) {
    const rec = await store.get(id);
    if (!rec) throw new Error(`no job ${id}`);
    return [describe(rec, defs.get(rec.kind))];
  }
  return (await store.list()).filter((r) => !isTerminal(r.state)).map((r) => describe(r, defs.get(r.kind)));
}
