// The job record (CONTRACT §job.record): queued → running → needs you → done | failed, with the reason in plain words,
// the cost and where the output went. Pure functions over a plain object; storage sits behind JobStore.
export const JOB_STATES = ['queued', 'running', 'needs-you', 'done', 'failed'] as const;
export type JobState = (typeof JOB_STATES)[number];

/** Where a finished job's output went: an area's home and the id of what it wrote there. */
export type OutputLocation = {
  home: 'library' | 'today' | 'notes' | 'activity';
  id: string;
};

export type JobRecord = {
  id: string;
  kind: string;
  title: string;
  state: JobState;
  /** Plain-words reason; required on failed, and on needs-you it says what Matt must do. */
  reason?: string;
  /** The step a needs-you job is waiting at; Matt's answer continues it as `jobId:step`. */
  step?: string;
  costCents: number;
  output?: OutputLocation;
  createdAt: string;
  updatedAt: string;
  needsYouAt?: string;
  /** Row version for the store's compare-and-set (a stale write is refused). */
  v: number;
};

/** Storage seam: D1 in production, a Map in tests. put succeeds only when rec.v is one past the stored version. */
export interface JobStore {
  get(id: string): Promise<JobRecord | undefined>;
  put(rec: JobRecord): Promise<boolean>;
  list(): Promise<JobRecord[]>;
}

const NEXT: Record<JobState, readonly JobState[]> = {
  queued: ['running', 'failed'],
  running: ['needs-you', 'done', 'failed'],
  'needs-you': ['running', 'failed'],
  done: [],
  failed: [],
};

export const isTerminal = (s: JobState): boolean => NEXT[s].length === 0;

export function newJob(a: { id: string; kind: string; title: string; at: string }): JobRecord {
  if (!a.id || !a.kind || !a.title) throw new Error('job: id, kind and title are required');
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    state: 'queued',
    costCents: 0,
    createdAt: a.at,
    updatedAt: a.at,
    v: 1,
  };
}

export type Move = {
  to: JobState;
  at: string;
  reason?: string;
  step?: string;
  output?: OutputLocation;
};

/** The next record for a lifecycle move; throws on an illegal move or a missing reason/output/step. */
export function transition(rec: JobRecord, m: Move): JobRecord {
  if (!NEXT[rec.state].includes(m.to)) throw new Error(`job ${rec.id}: cannot go from ${rec.state} to ${m.to}`);
  if ((m.to === 'failed' || m.to === 'needs-you') && !m.reason?.trim())
    throw new Error(`job ${rec.id}: ${m.to} needs a reason in plain words`);
  if (m.to === 'needs-you' && !m.step) throw new Error(`job ${rec.id}: needs-you must name its step`);
  if (m.to === 'done' && !m.output) throw new Error(`job ${rec.id}: done must say where the output went`);
  const next: JobRecord = {
    ...rec,
    state: m.to,
    updatedAt: m.at,
    v: rec.v + 1,
  };
  if (m.to === 'running') {
    delete next.reason;
    delete next.step;
    delete next.needsYouAt;
  }
  if (m.reason) next.reason = m.reason.trim();
  if (m.to === 'needs-you') {
    next.step = m.step;
    next.needsYouAt = m.at;
  }
  if (m.output) next.output = m.output;
  return next;
}

/** Adds spend to the record (whole cents, never negative). */
export function addCost(rec: JobRecord, cents: number, at: string): JobRecord {
  if (!Number.isFinite(cents) || cents < 0) throw new Error(`job ${rec.id}: cost must be a number of cents, 0 or more`);
  return {
    ...rec,
    costCents: rec.costCents + cents,
    updatedAt: at,
    v: rec.v + 1,
  };
}

/** Applies a pure update to a stored job; refuses a stale write instead of overwriting it. */
export async function update(store: JobStore, id: string, f: (r: JobRecord) => JobRecord): Promise<JobRecord> {
  const cur = await store.get(id);
  if (!cur) throw new Error(`job ${id}: not found`);
  const next = f(cur);
  if (!(await store.put(next))) throw new Error(`job ${id}: changed under us (409); reread and retry`);
  return next;
}
