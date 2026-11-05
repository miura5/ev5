// The Chart on disk: its files, statuses and kinds, load and save in ev4's exact serialization, the next free ids and
// Central time. deploys.json and history/ (ev4's finished tasks and its older decisions) are frozen: they are
// loaded and linted, links resolve into them, and they are never written.
import fs from 'node:fs';
import path from 'node:path';

export const TASK_STATUS = ['inbox', 'open', 'in progress', 'blocked', 'done', 'declined'] as const;
export const TASK_KINDS = ['task', 'bug', 'request'] as const;
export const DECISION_STATUS = ['proposed', 'accepted', 'superseded', 'revisit'] as const;
export const DECISION_KINDS = ['decision', 'tenet'] as const;
export const TENET_SCOPES = ['ui', 'data', 'ops', 'pipelines'] as const;
export const TENET_CHECKS = ['harness', 'lint', 'ship', 'review'] as const;
export const TZ = 'America/Chicago';

// Records keep ev4's open shape: known fields are typed, anything else ev4 wrote rides along untouched.
export interface Task {
  id: string;
  kind: string;
  title: string;
  dod: string | null;
  milestone: string;
  status: string;
  depends: string[];
  notes: string;
  commit: string | null;
  source: string;
  [k: string]: unknown;
}
export interface Decision {
  id: string;
  date: string;
  title: string;
  why: string;
  status: string;
  supersedes: string[];
  amends: string[];
  source: string;
  kind?: string;
  scope?: string[];
  check?: string;
  [k: string]: unknown;
}
export interface Deploy {
  target: string;
  commit: string;
  time: string;
  [k: string]: unknown;
}
/** One filed-later entry: a provisional id (P-1, P-2 ...) and the flags its task add or decision add would take. */
export interface InboxEntry {
  id: string;
  type: 'task' | 'decision';
  flags: Record<string, string>;
}
/** chart/inbox/<session>.json: a session's entries waiting for the lock holder to give them real ids. */
export interface InboxFile {
  file: string;
  session: string;
  entries: InboxEntry[];
}
export interface Chart {
  tasks: Task[];
  decisions: Decision[];
  deploys: Deploy[];
  history: { tasks: Task[]; decisions: Decision[] };
  inbox: InboxFile[];
}

export const FILES = ['tasks', 'decisions', 'deploys'] as const;
export const FROZEN = new Set<string>(['deploys']);
const HISTORY = ['tasks', 'decisions'] as const;

/** ev4's serialization: indent 1, no trailing newline. */
export const serialize = (v: unknown): string => JSON.stringify(v, null, 1);

export const chartDir = (root: string): string => path.join(root, 'chart');

export function loadChart(root: string): Chart {
  const dir = chartDir(root);
  const read = (f: string, fallback: unknown): unknown => {
    const p = path.join(dir, f + '.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;
  };
  const inboxDir = path.join(dir, 'inbox');
  const inbox = fs.existsSync(inboxDir)
    ? fs
        .readdirSync(inboxDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .map(
          f =>
            ({
              ...JSON.parse(fs.readFileSync(path.join(inboxDir, f), 'utf8')),
              file: f,
            }) as InboxFile,
        )
    : [];
  return {
    inbox,
    tasks: read('tasks', []) as Task[],
    decisions: read('decisions', []) as Decision[],
    deploys: read('deploys', []) as Deploy[],
    history: { tasks: read('history/tasks', []) as Task[], decisions: read('history/decisions', []) as Decision[] },
  };
}

/** Writes every file but the frozen ones; refuses when the frozen history was changed in memory. */
export function saveChart(root: string, rec: Chart): void {
  const dir = chartDir(root);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of FROZEN) {
    const p = path.join(dir, f + '.json');
    const onDisk = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : serialize([]);
    if (serialize(rec[f as keyof Chart]) !== onDisk)
      throw new Error(`chart/${f}.json is frozen v4 history: the writer never changes it`);
  }
  for (const f of HISTORY) {
    const p = path.join(dir, 'history', f + '.json');
    if (serialize(rec.history[f]) !== (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : serialize([])))
      throw new Error(`chart/history/${f}.json is frozen v4 history: the writer never changes it`);
  }
  for (const f of FILES) {
    if (FROZEN.has(f)) continue;
    const p = path.join(dir, f + '.json'),
      text = serialize(rec[f]);
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) fs.writeFileSync(p, text);
  }
}

/** Every task and decision the record knows, the frozen history included: what a link may name. */
export const allTasks = (rec: Chart): Task[] => [...rec.history.tasks, ...rec.tasks];
export const allDecisions = (rec: Chart): Decision[] => [...rec.history.decisions, ...rec.decisions];

const highest = (xs: string[]): number => Math.max(0, ...xs.map(id => Number(id.slice(2))).filter(Number.isFinite));
/** The next free task id: one past the highest, continuing ev4's sequence. */
export const nextTaskId = (rec: Chart): string => 'B-' + String(highest(allTasks(rec).map(t => t.id)) + 1).padStart(2, '0');
export const nextDecisionId = (rec: Chart): string =>
  'D-' + String(highest(allDecisions(rec).map(d => d.id)) + 1).padStart(3, '0');

export const kindOf = (d: Decision): string => d.kind || 'decision';
export const list = (s: unknown): string[] =>
  s == null || s === true
    ? []
    : String(s)
        .split(/[\s,]+/)
        .filter(Boolean);

const parts = (d: Date, o: Intl.DateTimeFormatOptions): Record<string, string> =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...o }).formatToParts(d).map(p => [p.type, p.value]),
  );
/** "Oct 19" in Central time. */
export const ctDate = (iso: string): string => {
  const p = parts(new Date(iso), { month: 'short', day: 'numeric' });
  return `${p.month} ${p.day}`;
};
