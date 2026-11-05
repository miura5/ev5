// The inbox: how a session without the build lock records a task or decision. It writes chart/inbox/<session>.json
// with provisional ids P-1, P-2 ... (per file); the lock holder's `inbox file` gives each entry the next real id in
// order, rewrites the P- references, and deletes the inbox file. Each inbox file is new, so sessions never collide.
import fs from 'node:fs';
import path from 'node:path';
import { chartDir, list, serialize } from './chart.ts';
import type { Chart, InboxEntry, InboxFile } from './chart.ts';
import { decisionAdd } from './decisions.ts';
import { taskAdd } from './tasks.ts';
import type { Done, Opts } from './tasks.ts';

const P = /^P-\d+$/;
const REF_FLAGS: Record<InboxEntry['type'], string[]> = {
  task: ['depends'],
  decision: ['supersedes', 'amends'],
};
const SKIP = new Set(['_', 'root', 'now', 'session']);

export const inboxDir = (root: string): string => path.join(chartDir(root), 'inbox');
const fileName = (session: string): string => session.replace(/[^A-Za-z0-9._-]/g, '_') + '.json';

/** Adds one entry to this session's inbox file and returns its provisional id. Nothing else in the Chart is read-written. */
export function inboxAdd(root: string, rec: Chart, o: Opts, session: string): Done {
  const type = o._[2];
  if (type !== 'task' && type !== 'decision') throw new Error('inbox add task|decision --title <t> ...');
  if (!session) throw new Error('inbox add needs a session id (set CLAUDE_CODE_REMOTE_SESSION_ID or pass --session)');
  const flags: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) if (!SKIP.has(k) && typeof v === 'string') flags[k] = v;
  if (!flags.title) throw new Error(`inbox add ${type} needs --title`);
  const file = fileName(session);
  const p = path.join(inboxDir(root), file);
  const cur: InboxFile = fs.existsSync(p)
    ? JSON.parse(fs.readFileSync(p, 'utf8'))
    : { file, session, entries: [] as InboxEntry[] };
  const mine = new Map(cur.entries.map(e => [e.id, e.type]));
  for (const f of REF_FLAGS[type])
    for (const x of list(flags[f])) {
      const ok = P.test(x) ? mine.get(x) === type : (type === 'task' ? rec.tasks : rec.decisions).some(y => y.id === x);
      if (!ok)
        throw new Error(`--${f} ${x}: ${P.test(x) ? 'no such earlier entry in this inbox' : 'not in the record'}`);
    }
  const id = 'P-' + (Math.max(0, ...cur.entries.map(e => Number(e.id.slice(2)))) + 1);
  cur.entries.push({ id, type, flags });
  fs.mkdirSync(inboxDir(root), { recursive: true });
  fs.writeFileSync(p, serialize({ session: cur.session, entries: cur.entries }));
  return {
    id,
    what: `queued ${type} in chart/inbox/${file}; the lock holder files it with ops/record inbox file`,
  };
}

/** Files every inbox file (in name order, entries in order): real ids, P- references rewritten, files deleted. */
export function inboxFile(root: string, rec: Chart, now: string): Done {
  const made: string[] = [];
  for (const f of rec.inbox) {
    const real = new Map<string, string>();
    const fix = (v: string | undefined): string | undefined =>
      v == null
        ? v
        : list(v)
            .map(x => (P.test(x) ? (real.get(x) ?? x) : x))
            .join(',');
    for (const e of f.entries) {
      const flags: Record<string, string> = { ...e.flags };
      for (const k of REF_FLAGS[e.type]) if (flags[k] != null) flags[k] = fix(flags[k]) as string;
      const o: Opts = { _: ['', e.type], ...flags };
      const done = (e.type === 'task' ? taskAdd : decisionAdd)(rec, o, now);
      real.set(e.id, done.id);
      made.push(`${f.session} ${e.id}=${done.id}`);
    }
  }
  return {
    id: made.length ? 'inbox' : '-',
    what: made.length ? `filed ${made.join(', ')}` : 'inbox is empty',
  };
}

/** Removes the filed inbox files; called after the Chart is saved so a refusal leaves them in place. */
export function clearInbox(root: string, rec: Chart): void {
  for (const f of rec.inbox) fs.rmSync(path.join(inboxDir(root), f.file), { force: true });
  rec.inbox = [];
}
