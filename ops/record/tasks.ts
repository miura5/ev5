// Task commands: add, set and claim. Each takes the Chart and the parsed flags, changes the Chart in memory and
// returns what it did; the CLI saves. A refusal throws.
import type { Chart, Task } from './chart.ts';
import { TASK_KINDS, TASK_STATUS, ctDate, list, nextTaskId, allTasks } from './chart.ts';
import { PLACES } from './render.ts';

export type Opts = Record<string, string | boolean | undefined> & { _: string[] };
export interface Done {
  what: string;
  id: string;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const TASK_ID = /^B-\d+$/;

function checkDepends(rec: Chart, deps: string[], self: string | null): void {
  for (const d of deps) {
    if (!TASK_ID.test(d)) throw new Error(`--depends ${d}: a task id like B-123`);
    if (d === self) throw new Error(`${self} cannot depend on itself`);
    if (!allTasks(rec).some(t => t.id === d)) throw new Error(`--depends ${d}: no such task`);
  }
}

/** A new task with the next free id. A bug or request also needs Matt's words and where they came from. */
export function taskAdd(rec: Chart, o: Opts, now: string): Done {
  const title = str(o.title),
    kind = str(o.kind) || 'task';
  if (!title) throw new Error('task add needs --title');
  if (!(TASK_KINDS as readonly string[]).includes(kind)) throw new Error(`--kind ${TASK_KINDS.join('|')}`);
  const report = kind !== 'task';
  const milestone = str(o.milestone) || (report ? 'Inbox' : null);
  if (!milestone) throw new Error('task add needs --milestone');
  const depends = list(o.depends);
  checkDepends(rec, depends, null);
  const id = nextTaskId(rec);
  const t: Task = {
    id,
    kind,
    title,
    dod: str(o.dod),
    milestone,
    status: report ? 'inbox' : 'open',
    depends,
    notes: str(o.notes) || '',
    commit: null,
    source: str(o.source) || (report ? '' : 'ops/record'),
  };
  if (report) {
    const words = str(o.words);
    if (!words || !t.source) throw new Error(`a ${kind} needs --words and --source`);
    t.words = words;
    t.reportedAt = now;
  }
  rec.tasks.push(t);
  return { what: `new ${kind} (${t.status}, ${milestone})${report ? `, reported ${ctDate(now)}` : ''}`, id };
}

function one(rec: Chart, id: string | undefined): Task {
  const ts = rec.tasks.filter(t => t.id === id);
  if (!id || !ts.length) throw new Error(`no task ${id} in the record`);
  if (ts.length > 1) throw new Error(`${ts.length} tasks carry ${id}: the writer will not guess which`);
  return ts[0] as Task;
}

/** Change a task's fields. Moving it to in progress goes through claim, so the lock is never skipped. */
export function taskSet(rec: Chart, o: Opts, now: string): Done {
  const t = one(rec, o._[2]),
    what: string[] = [];
  const status = str(o.status);
  if (status) {
    if (!(TASK_STATUS as readonly string[]).includes(status))
      throw new Error(`--status ${status}: one of ${TASK_STATUS.join(', ')}`);
    if (status === 'in progress') throw new Error(`use task claim ${t.id} --by <run>: the claim is the lock`);
    if (status === 'inbox') throw new Error('a task never goes back to the inbox');
    if (status === 'done' && !(str(o.commit) || t.commit)) throw new Error(`${t.id} done needs --commit`);
    if (status === 'declined') {
      const reason = str(o.reason);
      if (!reason) throw new Error('--status declined needs --reason');
      t.triage = { outcome: 'declined', reason, at: now };
    }
    what.push(`${t.status} -> ${status}`);
    t.status = status;
    if (['done', 'declined'].includes(status) && t.waitingOn) {
      delete t.waitingOn;
      delete t.waitingWhere;
      what.push('no longer waiting');
    }
  }
  for (const f of ['title', 'dod', 'milestone', 'notes'] as const) {
    const v = str(o[f]);
    if (v != null) {
      t[f] = v;
      what.push(f);
    }
  }
  if (typeof o.depends === 'string') {
    const deps = list(o.depends);
    checkDepends(rec, deps, t.id);
    t.depends = deps;
    delete t.dependsText;
    what.push('depends');
  }
  const commit = str(o.commit);
  if (commit) {
    t.commit = commit.slice(0, 7);
    what.push(`commit ${t.commit}`);
  }
  const waiting = str(o['waiting-on']);
  if (waiting != null) {
    if (waiting && waiting !== 'none') t.waitingOn = waiting;
    else {
      delete t.waitingOn;
      delete t.waitingWhere;
    }
    what.push('waiting on');
  }
  const where = str(o.where);
  if (where != null) {
    if (!PLACES[where]) throw new Error(`--where ${where}: one of ${Object.keys(PLACES).join(', ')}`);
    t.waitingWhere = where;
    what.push('where');
  }
  if (!what.length)
    throw new Error('nothing to set: give --status, --notes, --commit, --title, --dod, --milestone or --depends');
  return { what: what.join(', '), id: t.id };
}

/** The lock: an open or blocked task moves to in progress, held by one run. A held or finished task is refused. */
export function taskClaim(rec: Chart, o: Opts, now: string): Done {
  const t = one(rec, o._[2]),
    by = str(o.by);
  if (!by) throw new Error('task claim needs --by <run>');
  if (t.status === 'in progress')
    throw new Error(`${t.id} is already in progress${t.claimedBy ? ` (held by ${t.claimedBy})` : ''}: take nothing`);
  if (!['open', 'blocked'].includes(t.status)) throw new Error(`${t.id} is ${t.status}: only an open or blocked task`);
  t.status = 'in progress';
  t.claimedBy = by;
  t.claimedAt = now;
  return { what: `claimed by ${by}`, id: t.id };
}
