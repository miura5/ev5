// Decision commands. A decision takes the next free id in the one sequence carried from ev4; the frozen history
// (chart/history/) is never changed, only linked to.
import type { Chart, Decision } from './chart.ts';
import {
  DECISION_KINDS,
  DECISION_STATUS,
  TENET_CHECKS,
  TENET_SCOPES,
  ctDate,
  kindOf,
  list,
  nextDecisionId,
  allDecisions,
} from './chart.ts';
import type { Done, Opts } from './tasks.ts';

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function apply(rec: Chart, d: Decision, o: Opts, now: string, isNew: boolean): void {
  const title = str(o.title),
    why = str(o.why);
  if (!isNew && ((title && title !== d.title) || (why && why !== d.why))) d.restated = ctDate(now);
  if (title) d.title = title;
  if (why) d.why = why;
  const status = str(o.status);
  if (status) {
    if (!(DECISION_STATUS as readonly string[]).includes(status))
      throw new Error(`--status ${status}: one of ${DECISION_STATUS.join(', ')}`);
    d.status = status;
  }
  for (const f of ['supersedes', 'amends'] as const) {
    if (typeof o[f] !== 'string') continue;
    const xs = list(o[f]);
    for (const x of xs) {
      if (x === d.id) throw new Error(`${d.id} cannot name itself in --${f}`);
      if (!allDecisions(rec).some(y => y.id === x)) throw new Error(`--${f} ${x}: no such decision`);
    }
    d[f] = xs;
  }
  const kind = str(o.kind);
  if (kind) {
    if (!(DECISION_KINDS as readonly string[]).includes(kind)) throw new Error(`--kind ${DECISION_KINDS.join('|')}`);
    d.kind = kind;
  }
  if (typeof o.scope === 'string') d.scope = list(o.scope);
  const check = str(o['checked-by']);
  if (check) d.check = check;
  if (kindOf(d) === 'tenet') {
    if (!(d.scope || []).length || (d.scope || []).some(x => !(TENET_SCOPES as readonly string[]).includes(x)))
      throw new Error(`a tenet needs --scope, one or more of ${TENET_SCOPES.join(', ')}`);
    if (!(TENET_CHECKS as readonly string[]).includes(d.check || ''))
      throw new Error(`a tenet needs --checked-by, one of ${TENET_CHECKS.join(', ')}`);
  } else {
    delete d.scope;
    delete d.check;
  }
  if (!d.title) throw new Error('a decision needs --title');
  for (const s of d.supersedes) {
    const x = rec.decisions.find(y => y.id === s);
    if (x) x.status = 'superseded';
  }
}

/** A new decision, newest first in chart/decisions.json as ev4 kept it. */
export function decisionAdd(rec: Chart, o: Opts, now: string): Done {
  const d: Decision = {
    id: nextDecisionId(rec),
    date: ctDate(now),
    title: '',
    why: '',
    status: 'proposed',
    supersedes: [],
    amends: [],
    source: str(o.source) || 'ops/record',
  };
  apply(rec, d, o, now, true);
  rec.decisions.unshift(d);
  return { what: `${kindOf(d)} ${d.id} (${d.status})`, id: d.id };
}

export function decisionSet(rec: Chart, o: Opts, now: string): Done {
  const id = o._[2],
    d = rec.decisions.find(x => x.id === id);
  if (!d) throw new Error(`no decision ${id} in the record`);
  if (!['title', 'why', 'status', 'supersedes', 'amends', 'kind', 'scope', 'checked-by'].some(f => o[f] != null))
    throw new Error('nothing to set: give --title, --why, --status, --supersedes or --amends');
  apply(rec, d, o, now, false);
  return { what: `${kindOf(d)} ${d.id} (${d.status})`, id: d.id };
}
