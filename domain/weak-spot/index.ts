import { addDays, centralDate, daysBetween } from '../time/index.ts';
import {
  REVIEW_RULES,
  type Attempt,
  type Derived,
  type ReviewRules,
  type Status,
  type WeakSpot,
  type WeakSpotEvent,
} from './types.ts';
export {
  /** @public */
  WEAK_SPOT_KINDS,
  /** @public */
  EVENT_TYPES,
  /** @public */
  REVIEW_RULES,
  type WeakSpotEvent,
  type WeakSpot,
  type Attempt,
  /** @public */
  type Status,
  type Derived,
  type ReviewRules,
} from './types.ts';
export { parseWeakSpot } from './parse.ts';

const KEY_TIME = /-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(\d{3})?(?:-[a-z0-9]+)?$/;
const UNTRIAGED: Status[] = ['proposed', 'snoozed', 'declined', 'duplicate'];
const ms = (x: string) => Date.parse(x.length === 10 ? `${x}T12:00:00Z` : x);

/** When an appended entry happened: its own `at`, else the time in its key. */
export function entryTime(key: string, e: { at?: string }): string {
  if (e.at) return e.at;
  const m = KEY_TIME.exec(key);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7] ?? '000'}Z` : key;
}

function applyEvent(st: Derived, e: WeakSpotEvent, at: string, date: string): void {
  switch (e.type) {
    case 'park':
      st.status = 'parked';
      st.parkedReason = e.note ?? '';
      break;
    case 'move':
      st.status = 'moved';
      break;
    case 'activate':
      Object.assign(st, { status: 'open', streak: 0, nextDue: date });
      break;
    case 'solid':
      Object.assign(st, {
        status: 'reviewed',
        solidBy: e.by ?? 'owner',
        solidAt: at,
        preRead: false,
      });
      break;
    case 'done':
      Object.assign(st, { status: 'reviewed', solidBy: 'done', solidAt: at });
      break;
    case 'reopen':
      Object.assign(st, {
        status: 'open',
        streak: 0,
        nextDue: date,
        reopenedAt: at,
      });
      break;
    case 'accept':
      if (st.status !== 'open')
        Object.assign(st, {
          status: 'open',
          streak: 0,
          nextDue: addDays(date, 1),
          snoozedUntil: null,
        });
      if (e.objective) st.objective = e.objective;
      break;
    case 'snooze':
      Object.assign(st, { status: 'snoozed', snoozedUntil: e.until ?? null });
      break;
    case 'decline':
      Object.assign(st, { status: 'declined', snoozedUntil: null });
      break;
    case 'seen':
      if (UNTRIAGED.includes(st.status)) break;
      Object.assign(st, {
        recurrence: st.recurrence + 1,
        streak: 0,
        nextDue: addDays(date, 1),
      });
      if (st.status === 'reviewed')
        Object.assign(st, {
          status: 'open',
          reopenedAt: at,
          solidBy: null,
          solidAt: null,
        });
      break;
  }
}

export type DeriveOpts = {
  /** The date of this spot's exam, for the near-exam interval. */
  examDate?: string | null;
  duplicateOf?: string | null;
  /** A duplicate's `seen` events, credited to this survivor. */
  credited?: Record<string, WeakSpotEvent>;
  rules?: ReviewRules;
  /** The id of this spot, so the answer that created it is not one of its reviews. */
  id?: string;
};

const wrong = (date: string) => ({
  streak: 0,
  nextDue: addDays(date, 1),
  lastReviewed: date,
  lastResult: 'wrong',
});

/** Rebuilds a weak spot's state from its facts, events and answers (ev4's spaced-review rules, including the pre-read rule). */
export function deriveWeakSpot(f: WeakSpot, attempts: Attempt[], opts: DeriveOpts = {}): Derived {
  const R = opts.rules ?? REVIEW_RULES;
  const st: Derived = {
    status: f.proposed ? 'proposed' : 'open',
    streak: f.initial.streak ?? 0,
    nextDue: f.initial.nextDue ?? null,
    misses: f.initial.misses ?? 0,
    recurrence: f.initial.recurrence ?? 1,
    lastReviewed: null,
    lastResult: null,
    solidBy: null,
    solidAt: null,
    preRead: !!f.preRead,
    reopenedAt: null,
    answered: 0,
    right: 0,
    history: [],
  };
  const examDate = opts.examDate ?? null;
  const concept = f.kind === 'concept';
  type Entry = { at: string; e?: WeakSpotEvent; a?: Attempt };
  const timeline: Entry[] = [
    ...Object.entries(f.events).map(([k, e]) => ({ at: entryTime(k, e), e })),
    ...Object.entries(opts.credited ?? {}).map(([k, e]) => ({
      at: entryTime(k, e),
      e,
    })),
    ...attempts.filter((a) => !a.created || a.created !== opts.id).map((a) => ({ at: a.at, a })),
  ].sort((x, y) => ms(x.at) - ms(y.at));
  for (const t of timeline) {
    const date = centralDate(new Date(t.at));
    if (t.e) {
      applyEvent(st, t.e, t.at, date);
      continue;
    }
    const a = t.a as Attempt;
    if (!concept || st.status === 'parked' || st.status === 'moved' || UNTRIAGED.includes(st.status)) continue;
    st.answered++;
    if (a.correct) st.right++;
    st.history.push({ date, correct: !!a.correct });
    if (st.preRead) {
      st.preRead = false;
      if (a.correct)
        Object.assign(st, {
          status: 'reviewed',
          streak: R.solidAfterRightDays,
          solidBy: 'first-check-after-reading',
          solidAt: t.at,
          lastReviewed: date,
          lastResult: 'right',
        });
      else Object.assign(st, wrong(date), { misses: st.misses + 1 });
      continue;
    }
    if (a.matched) {
      Object.assign(st, wrong(date), { recurrence: st.recurrence + 1 });
      if (st.status === 'reviewed') Object.assign(st, { status: 'open', reopenedAt: t.at });
      continue;
    }
    if (a.correct) {
      if (st.status === 'reviewed') {
        st.lastReviewed = date;
        st.lastResult = 'right';
        continue;
      }
      if (st.lastReviewed === date && st.lastResult === 'right') continue; // advances at most once per day
      st.streak += 1;
      st.lastReviewed = date;
      st.lastResult = 'right';
      if (st.streak >= R.solidAfterRightDays) {
        Object.assign(st, {
          status: 'reviewed',
          solidBy: 'review',
          solidAt: t.at,
        });
        continue;
      }
      const toExam = examDate && examDate >= date ? daysBetween(date, examDate) : null;
      const near = toExam != null && toExam <= R.nearExamWithinDays;
      let next = addDays(date, near ? R.intervalNearExamDays : R.intervalDays);
      if (examDate && toExam != null && toExam > 1 && next >= examDate) next = addDays(examDate, -1);
      st.nextDue = next;
    } else {
      Object.assign(st, wrong(date), { misses: st.misses + 1 });
      if (st.status === 'reviewed')
        Object.assign(st, {
          status: 'open',
          recurrence: st.recurrence + 1,
          reopenedAt: t.at,
          solidBy: null,
          solidAt: null,
        });
    }
  }
  st.history = st.history.slice(-20);
  if (!concept && st.status === 'open') st.nextDue = null;
  if (opts.duplicateOf) Object.assign(st, { status: 'duplicate', duplicateOf: opts.duplicateOf });
  return st;
}

type Model = { kind?: string; readingDue?: string | null; derived: Derived };

/** An open concept spot. */
export const isActive = (w: Model): boolean => (w.kind ?? 'concept') === 'concept' && w.derived.status === 'open';
/** A concept spot marked solid. */
export const isSolid = (w: Model): boolean => (w.kind ?? 'concept') === 'concept' && w.derived.status === 'reviewed';

/** Whether an active spot is due on `date` (a pre-read spot waits for its reading date). */
export function isDue(w: Model, date: string): boolean {
  if (!isActive(w) || !w.derived.nextDue) return false;
  if (w.derived.preRead && w.readingDue && w.readingDue > date) return false;
  return w.derived.nextDue <= date;
}

/** How many more right days a spot needs before it is solid. */
export const reviewNeed = (w: Model, rules: ReviewRules = REVIEW_RULES): number =>
  w.derived.preRead ? 1 : Math.max(0, rules.solidAfterRightDays - w.derived.streak);
