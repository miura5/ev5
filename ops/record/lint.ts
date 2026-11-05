// The Chart against its rules. Link checks: every id named in a task's depends, a decision's supersedes and amends
// must resolve, in the live files or in chart/history. Shape checks: duplicate ids, unknown statuses and kinds, a done
// task with no commit, a report without its words, a malformed deploy.
import type { Chart } from './chart.ts';
import {
  DECISION_KINDS,
  DECISION_STATUS,
  TASK_KINDS,
  TASK_STATUS,
  TENET_CHECKS,
  TENET_SCOPES,
  allDecisions,
  allTasks,
  kindOf,
  list,
} from './chart.ts';

export interface Finding {
  level: 'error' | 'warn';
  check: string;
  id: string;
  detail: string;
}
// The checks that are links: what lint reports as dangling.
export const LINK_CHECKS = new Set([
  'missing-dependency',
  'missing-decision',
  'broken-inbox-depends',
]);

const has = (xs: readonly string[], x: unknown): boolean => xs.includes(String(x));

function duplicates(xs: string[]): [string, number][] {
  const seen: Record<string, number> = {};
  for (const x of xs) seen[x] = (seen[x] || 0) + 1;
  return Object.entries(seen).filter(([, n]) => n > 1);
}

export function lintChart(rec: Chart): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding['level'], check: string, id: string, detail: string): void => {
    out.push({ level, check, id, detail });
  };
  for (const [id, n] of duplicates(allTasks(rec).map(t => t.id)))
    add('error', 'duplicate-id', id, `${n} tasks carry ${id}`);
  for (const [id, n] of duplicates(allDecisions(rec).map(d => d.id)))
    add('error', 'duplicate-id', id, `${n} decisions carry ${id}`);

  const tasks = new Set(allTasks(rec).map(t => t.id)),
    decisions = new Map(allDecisions(rec).map(d => [d.id, d]));
  for (const t of allTasks(rec)) {
    for (const d of t.depends || [])
      if (!tasks.has(d)) add('error', 'missing-dependency', t.id, `depends on ${d}, which is not in the record`);
    const into = (t.triage as { into?: string } | undefined)?.into;
    if (into && !tasks.has(into))
      add('error', 'missing-dependency', t.id, `joined ${into}, which is not in the record`);
    if (!has(TASK_STATUS, t.status)) add('error', 'bad-status', t.id, `status "${t.status}"`);
    if (!has(TASK_KINDS, t.kind)) add('error', 'bad-kind', t.id, `kind "${t.kind}"`);
    if (t.status === 'done' && !t.commit) add('error', 'done-without-commit', t.id, 'done with no commit');
    if (t.kind !== 'task' && !(t.words && t.source && t.reportedAt))
      add('error', 'bad-report', t.id, 'a report needs its words, source and time');
    if (t.status === 'declined' && !(t.triage as { reason?: string } | undefined)?.reason)
      add('error', 'declined-without-reason', t.id, 'declined with no reason');
    if (t.status === 'inbox') add('warn', 'untriaged', t.id, `in the inbox since ${t.reportedAt}`);
    if (t.waitingOn && ['done', 'declined'].includes(t.status))
      add('warn', 'stale-waiting', t.id, `is ${t.status} but still waiting on ${t.waitingOn}`);
  }
  for (const d of allDecisions(rec)) {
    for (const x of [...(d.supersedes || []), ...(d.amends || [])])
      if (!decisions.has(x)) add('error', 'missing-decision', d.id, `names ${x}, which is not in the record`);
    if (!has(DECISION_STATUS, d.status)) add('error', 'bad-status', d.id, `status "${d.status}"`);
    if (!has(DECISION_KINDS, kindOf(d))) add('error', 'bad-kind', d.id, `kind "${d.kind}"`);
    if (kindOf(d) === 'tenet') {
      if (!(d.scope || []).length || (d.scope || []).some(x => !has(TENET_SCOPES, x)))
        add('error', 'tenet-scope', d.id, `scope "${(d.scope || []).join(', ')}"`);
      if (!has(TENET_CHECKS, d.check)) add('error', 'tenet-check', d.id, `checked by "${d.check}"`);
    }
  }
  // Provisional ids live only in chart/inbox, and what an inbox entry depends on must resolve.
  const P = /^P-\d+$/;
  for (const t of rec.tasks) {
    if (P.test(t.id)) add('error', 'provisional-id', t.id, 'a P- id outside chart/inbox');
    for (const d of t.depends || [])
      if (P.test(d)) add('error', 'provisional-id', t.id, `depends on ${d}, a P- id outside chart/inbox`);
  }
  for (const d of rec.decisions)
    for (const x of [d.id, ...(d.supersedes || []), ...(d.amends || [])])
      if (P.test(x)) add('error', 'provisional-id', d.id, `names ${x}, a P- id outside chart/inbox`);
  for (const f of rec.inbox || []) {
    const mine = new Map(f.entries.map(e => [e.id, e.type]));
    for (const [id, n] of duplicates(f.entries.map(e => e.id)))
      add('error', 'duplicate-id', id, `${n} entries in ${f.file}`);
    for (const e of f.entries) {
      if (!P.test(e.id)) add('error', 'bad-inbox', e.id, `${f.file}: an inbox id is P-<n>`);
      const refs: [string[], string][] =
        e.type === 'task'
          ? [[list(e.flags.depends), 'task']]
          : [
              [list(e.flags.supersedes), 'decision'],
              [list(e.flags.amends), 'decision'],
            ];
      for (const [ids, kind] of refs)
        for (const x of ids) {
          const ok = P.test(x)
            ? mine.get(x) === kind && f.entries.findIndex(y => y.id === x) < f.entries.indexOf(e)
            : (kind === 'task' ? tasks : decisions).has(x);
          if (!ok) add('error', 'broken-inbox-depends', e.id, `${f.file}: names ${x}, which does not resolve`);
        }
    }
  }
  for (const d of rec.deploys)
    if (!['staging', 'live'].includes(d.target) || !d.commit)
      add('error', 'bad-deploy', d.commit || '?', `deploy to ${d.target} with commit ${d.commit}`);
  return out;
}

export function formatLint(findings: Finding[]): string {
  const e = findings.filter(f => f.level === 'error').length,
    w = findings.length - e,
    dangling = findings.filter(f => LINK_CHECKS.has(f.check)).length;
  return [
    `chart lint: ${e ? 'RED' : 'GREEN'}: ${e} error${e === 1 ? '' : 's'} (${dangling} dangling), ${w} warning${w === 1 ? '' : 's'}`,
    ...findings.map(f => `  ${f.level === 'error' ? 'NO  ' : 'warn'} ${f.check} ${f.id}: ${f.detail}`),
  ].join('\n');
}
