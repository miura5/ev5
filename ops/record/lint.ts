// The Chart against its rules. Link checks: every id named in a task's depends, a decision's supersedes and amends,
// and a rule's decision and task must resolve. Shape checks: duplicate ids, unknown statuses and kinds, a done task
// with no commit, a report without its words, a malformed deploy or release.
import type { Chart } from './chart.ts';
import { DECISION_KINDS, DECISION_STATUS, RELEASE_TARGETS, TASK_KINDS, TASK_STATUS, TENET_CHECKS, TENET_SCOPES, kindOf } from './chart.ts';

export interface Finding {
  level: 'error' | 'warn';
  check: string;
  id: string;
  detail: string;
}
// The checks that are links: what lint reports as dangling.
export const LINK_CHECKS = new Set(['missing-dependency', 'missing-decision', 'rule-decision', 'rule-task']);

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
  for (const [id, n] of duplicates(rec.tasks.map(t => t.id))) add('error', 'duplicate-id', id, `${n} tasks carry ${id}`);
  for (const [id, n] of duplicates(rec.decisions.map(d => d.id)))
    add('error', 'duplicate-id', id, `${n} decisions carry ${id}`);
  for (const [id, n] of duplicates(rec.rules.map(r => r.id))) add('error', 'duplicate-id', id, `${n} rules carry ${id}`);

  const tasks = new Set(rec.tasks.map(t => t.id)),
    decisions = new Map(rec.decisions.map(d => [d.id, d]));
  for (const t of rec.tasks) {
    for (const d of t.depends || [])
      if (!tasks.has(d)) add('error', 'missing-dependency', t.id, `depends on ${d}, which is not in the record`);
    const into = (t.triage as { into?: string } | undefined)?.into;
    if (into && !tasks.has(into)) add('error', 'missing-dependency', t.id, `joined ${into}, which is not in the record`);
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
  for (const d of rec.decisions) {
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
  for (const r of rec.rules) {
    const d = decisions.get(r.decision);
    if (!d) add('error', 'rule-decision', r.id, `rests on ${r.decision}, which is not in the record`);
    else if (d.status === 'superseded' && !r.ended)
      add('error', 'rule-superseded', r.id, `rests on ${r.decision}, which is superseded`);
    if (r.task && !tasks.has(r.task)) add('error', 'rule-task', r.id, `names ${r.task}, which is not in the record`);
  }
  for (const d of rec.deploys)
    if (!has(RELEASE_TARGETS, d.target) || !d.commit)
      add('error', 'bad-deploy', d.commit || '?', `deploy to ${d.target} with commit ${d.commit}`);
  for (const r of rec.releases) {
    if (!has(RELEASE_TARGETS, r.target) || !r.commit || !/^v5\.\d+\.\d+$/.test(r.version))
      add('error', 'bad-release', r.version || '?', `release ${r.version} to ${r.target} at ${r.commit}`);
    for (const x of r.tasks) if (!tasks.has(x)) add('error', 'missing-dependency', r.version, `names ${x}`);
    for (const x of r.decisions) if (!decisions.has(x)) add('error', 'missing-decision', r.version, `names ${x}`);
  }
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
