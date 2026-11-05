// BACKLOG.md and DECISIONS.md, generated from the Chart. The tables are ev4's renders translated line
// for line, so the carried record prints as ev4 printed it; only the header lines differ, and they are a parameter.
import type { Chart, Decision, Task } from './chart.ts';

export interface Headers {
  backlog: string[];
  closedTasks: string;
  yourTurnIntro: string;
  decisions: string[];
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
  closedTasks: 'Closed (done and declined) tasks are in chart/tasks.json; ev4\'s are frozen in chart/history/tasks.json.',
  yourTurnIntro: 'What waits on Matt, by where it happens.',
  decisions: [
    '# DECISIONS.md: E.V. v5 decisions and tenets',
    '',
    GENERATED,
    'Change one with `node ops/record/cli.ts decision …`; `render --check` fails when this file and chart/decisions.json',
    "differ. Decisions up to D-439 are ev4's, frozen in chart/history/decisions.json. D-001 to D-043 are in the v2 doc's",
    "decision log. Superseded decisions are in chart/decisions.json.",
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

/** The generated files, by name. */
export const generatedFiles = (rec: Chart, h: Headers = EV5_HEADERS): Record<string, string> => ({
  'BACKLOG.md': renderBacklog(rec, h),
  'DECISIONS.md': renderDecisions(rec, h),
});
