// BACKLOG.md, DECISIONS.md and CHANGELOG.md, generated from the Chart. The tables are ev4's renders translated line
// for line, so the carried record prints as ev4 printed it; only the header lines differ, and they are a parameter.
import type { Chart, Decision, Deploy, Release, Task } from './chart.ts';
import { ctClock, ctDate } from './chart.ts';

export interface Headers {
  backlog: string[];
  closedTasks: string;
  yourTurnIntro: string;
  decisions: string[];
  changelog: (releases: number) => string[];
}

const GENERATED = '**Generated from the Chart by `node ops/record/cli.ts`: never edit this file by hand.**';
export const EV5_HEADERS: Headers = {
  backlog: [
    '# E.V. v5 build backlog',
    '',
    '**Generated from the Chart (chart/tasks.json) by `node ops/record/cli.ts render`: never edit this file by hand.**',
    'Change the record with `node ops/record/cli.ts task …`; `render --check` fails when this file and the record differ.',
    'Status: `open` · `in progress` · `blocked` · `done`. A task opens when every id in Depends is `done`.',
  ],
  closedTasks: 'Closed (done and declined) tasks are in chart/tasks.json.',
  yourTurnIntro: 'What waits on Matt, by where it happens.',
  decisions: [
    '# DECISIONS.md: E.V. v5 decisions and tenets',
    '',
    GENERATED,
    'Change one with `node ops/record/cli.ts decision …`; `render --check` fails when this file and chart/decisions.json',
    "differ. D-044 to D-425 are ev4's history, carried as context. D-001 to D-043 are in the v2 doc's decision log.",
    'Superseded decisions are in chart/decisions.json.',
  ],
  changelog: n => [
    '# CHANGELOG.md: E.V. v5 releases and v4 deploys',
    '',
    GENERATED,
    'A v5 release reaches it through `node ops/record/cli.ts release add`; chart/deploys.json is frozen v4 history.',
    `Every v5 release, then the v4 deploys of the last ${n} live releases; every deploy is in chart/deploys.json.`,
  ],
};

const COLUMNS = '| Id | Task | Depends | Milestone | Status | Notes |\n| --- | --- | --- | --- | --- | --- |';
// A | inside a field would split the cell (GFM splits on every unescaped |), so it is escaped.
const cell = (s: unknown): string => String(s == null ? '' : s).replace(/\|/g, '\\|');
const taskText = (t: Task): string => t.title + (t.dod ? ' Done when: ' + t.dod : '');
const dependsText = (t: Task): string =>
  t.dependsText != null ? String(t.dependsText) : t.depends.length ? t.depends.join(', ') : '—';
const backlogRow = (t: Task): string =>
  `| ${t.id} | ${cell(taskText(t))} | ${cell(dependsText(t))} | ${cell(t.milestone)} | ${t.status} | ${cell(t.notes)} |`;
const INBOX = new Set(['inbox', 'declined']);

export const PLACES: Record<string, string> = {
  mac: 'At the Mac',
  staging: 'On the staging page',
  github: 'On GitHub',
  decision: 'A decision (a reply in a build chat)',
};
const board = (t: Task): { row?: string } => (t.board as { row?: string }) || {};
export const boardName = (t: Task): string =>
  board(t).row || `v4 ${t.id}: ${(t.name as string) || (t.title.split(/[:(]/)[0] as string).trim()}`;

/** Everything waiting on Matt, grouped by where it happens (a task with no place is a decision). */
export function yourTurn(rec: Chart): { place: string; label: string; tasks: Task[] }[] {
  const waiting = rec.tasks.filter(t => t.waitingOn === 'Matt' && !['done', 'declined'].includes(t.status));
  return Object.entries(PLACES)
    .map(([place, label]) => ({
      place,
      label,
      tasks: waiting.filter(t => (PLACES[t.waitingWhere as string] ? t.waitingWhere : 'decision') === place),
    }))
    .filter(g => g.tasks.length);
}
function yourTurnLines(rec: Chart): string[] {
  const groups = yourTurn(rec);
  if (!groups.length) return ['Nothing waits on Matt.'];
  const out: string[] = [];
  for (const g of groups) {
    out.push(`### ${g.label}`, '');
    for (const t of g.tasks) out.push(`- ${t.id} (${t.status}): ${cell(boardName(t).replace(/^v4 B-\d+: /, ''))}`);
    out.push('');
  }
  return out.slice(0, -1);
}

/** The open, blocked and in-progress tasks, then what waits on Matt by place, then the untriaged inbox. */
export function renderBacklog(rec: Chart, h: Headers = EV5_HEADERS): string {
  const tasks = rec.tasks.filter(t => !INBOX.has(t.status) && t.status !== 'done'),
    inbox = rec.tasks.filter(t => t.status === 'inbox');
  const out = [...h.backlog, '', h.closedTasks, '', COLUMNS, ...tasks.map(backlogRow)];
  out.push('', '## Your turn', '', h.yourTurnIntro, '', ...yourTurnLines(rec));
  if (inbox.length) {
    out.push(
      '',
      '## Inbox',
      '',
      "Reports in Matt's words, untriaged. Declined entries stay in chart/tasks.json, with their reasons.",
      '',
      '| Id | Kind | Reported | Words | Source | Status | Notes |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...inbox.map(
        t =>
          `| ${t.id} | ${t.kind} | ${t.reportedAt || ''} | ${cell(t.words)} | ${cell(t.source)} | ${t.status} | ${cell(t.notes)} |`
      )
    );
  }
  return out.join('\n');
}

const IN_FORCE = new Set(['accepted', 'proposed', 'revisit']);
/** The decisions and tenets still in force, newest first, with their reasoning and status. */
export function renderDecisions(rec: Chart, h: Headers = EV5_HEADERS): string {
  const ds = rec.decisions
    .filter(d => IN_FORCE.has(d.status))
    .sort((a, b) => Number(b.id.slice(2)) - Number(a.id.slice(2)));
  const kind = (d: Decision): string =>
    d.kind === 'tenet' ? `Tenet (${(d.scope || []).join(', ')}; checked by ${d.check || 'review'})` : '';
  const links = (d: Decision): string =>
    [
      d.supersedes && d.supersedes.length ? 'supersedes ' + d.supersedes.join(', ') : '',
      d.amends && d.amends.length ? 'amends ' + d.amends.join(', ') : '',
    ]
      .filter(Boolean)
      .join('; ');
  return [
    ...h.decisions,
    '',
    '| Id | Date | Decision | Why | Status | Links |',
    '| --- | --- | --- | --- | --- | --- |',
    ...ds.map(
      d =>
        `| ${d.id} | ${cell(d.date || '')} | ${cell([kind(d), d.title].filter(Boolean).join(': '))} | ${cell(d.why || '')} | ${d.status} | ${cell(links(d))} |`
    ),
  ].join('\n');
}

interface Line {
  date: string;
  change: string;
  why: string;
  decision: string;
}
/** The Changelog line ev4 gave a deploy, unless the deploy carries its own. */
export function changelogLine(d: Deploy): Line {
  if (d.line) return d.line as Line;
  const at = d.time && d.time.length > 10 ? ` (${ctClock(d.time)} CT)` : '';
  const verify = d.verify ? ` verify-deploy ${d.target} ${d.verify === 'green' ? 'GREEN' : d.verify}.` : '';
  const live =
    d.target === 'live' ? ` Rollback is a redeploy of ${d.rollback || '(none named)'}` : ' Live stays where it is';
  const notes = ((d.notes as string[]) || []).map(n => ` Note: ${n}`).join('');
  const tasks = (d.tasks as string[]) || [];
  const change = `v4 ${d.target} deployed at ${d.commit}${at}${d.from ? `, from ${d.from}` : ''}: ${d.summary || 'see the tasks'}${tasks.length ? ` (${tasks.join(', ')})` : ''}.${verify}${live}${notes}`;
  return {
    date: ctDate(d.time),
    change: change.replace(/\.\./g, '.'),
    why:
      (d.why as string) ||
      (d.target === 'live'
        ? `Matt's OK${d.okFrom && d.okFrom !== 'Matt' ? ' (' + d.okFrom + ')' : ''}`
        : 'The B-35 gate: staging first'),
    decision: ((d.decisions as string[]) || []).join(', ') || 'D-049',
  };
}
export function releaseLine(r: Release): Line {
  const tasks = r.tasks.length ? ` (${r.tasks.join(', ')})` : '';
  return {
    date: ctDate(r.time),
    change: `${r.version} ${r.target} at ${r.commit} (${ctClock(r.time)} CT): ${r.summary}${tasks}.`.replace(/\.\./g, '.'),
    why: r.target === 'live' ? "Matt's OK" : 'Staging first',
    decision: r.decisions.join(', '),
  };
}

// The v4 deploys since the 20th newest live release, staging ones between included.
const CHANGELOG_RELEASES = 20;
/** v5 releases newest first, then the v4 deploys of the last 20 live releases, newest first. */
export function renderChangelog(rec: Chart, h: Headers = EV5_HEADERS): string {
  const lives = rec.deploys.map((d, i) => (d.target === 'live' ? i : -1)).filter(i => i >= 0);
  const from = lives.length > CHANGELOG_RELEASES ? (lives[lives.length - CHANGELOG_RELEASES] as number) : 0;
  const rows = [
    ...[...rec.releases].reverse().map(releaseLine),
    ...rec.deploys.slice(from).reverse().map(changelogLine),
  ];
  return [
    ...h.changelog(CHANGELOG_RELEASES),
    '',
    '| Date | Change | Why | Decision |',
    '| --- | --- | --- | --- |',
    ...rows.map(l => `| ${cell(l.date)} | ${cell(l.change)} | ${cell(l.why)} | ${cell(l.decision)} |`),
  ].join('\n');
}

/** The three generated files, by name. */
export const generatedFiles = (rec: Chart, h: Headers = EV5_HEADERS): Record<string, string> => ({
  'BACKLOG.md': renderBacklog(rec, h),
  'DECISIONS.md': renderDecisions(rec, h),
  'CHANGELOG.md': renderChangelog(rec, h),
});
