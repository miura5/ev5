import { entryTime, toMs } from './stamp.ts';
import { SESSION_RULES, type Mark, type SessionDoc, type SessionEvent, type SessionRules } from './types.ts';

export type SessionState = {
  status: string;
  onBreak: boolean;
  nextCheckAt: string | null;
  breakRemainingMs: number;
  due: boolean;
  checks: number;
  questions: number;
  comments: number;
  reads: number;
  idleChecks: number;
  shouldWrap: boolean;
  lastCheck: { at: string; n?: number; msgId: string | null } | null;
  lastFormat: 'mc' | 'open' | null;
  lastMark: Mark | null;
  lastQuizMark: Mark | null;
  answered: Record<number, string | true>;
  minutes: number;
  overdueMs: number;
  /** How far the session is through the stretch to its next check, 0 to 1. */
  toCheck: number;
  writing: boolean;
  paused: boolean;
  pausedAt: string | null;
  activeMs: number;
  activeSince: string | null;
  planned: number | null;
  leftMs: number | null;
  breakStartedAt: string | null;
  timeUp: boolean;
};

const markOf = (e: SessionEvent): Mark => ({ noteId: e.noteId ?? null, len: e.len as number, h: e.h, modifiedAt: e.modifiedAt ?? null });
const iso = (ms: number) => new Date(ms).toISOString();

/** The clock's running parts, folded over the events in time order. */
type Clock = {
  next: number | null;
  span: number;
  breakAt: number | null;
  remaining: number;
  breakMs: number;
  endMs: number | null;
  endBreak: boolean;
  endPaused: boolean;
  pauseAt: number | null;
  pauseMs: number;
  since: number;
  plannedMs: number | null;
};

function endPause(st: SessionState, k: Clock, t: number): void {
  st.paused = false;
  k.pauseMs += Math.max(0, t - (k.pauseAt as number));
  k.pauseAt = null;
}

function endBreak(st: SessionState, k: Clock, t: number): void {
  st.onBreak = false;
  k.breakMs += t - (k.breakAt as number);
  k.breakAt = null;
}

function applyCheck(st: SessionState, k: Clock, e: SessionEvent, at: string, t: number, step: number): void {
  const mk = e.len != null ? markOf(e) : null;
  st.idleChecks = 0;
  if (mk) st.lastMark = mk;
  if (e.comment) {
    st.comments++;
    st.reads++;
    return;
  }
  st.reads++;
  k.next = t + step;
  k.span = step;
  if (e.quiet) return;
  st.checks++;
  st.questions += Number(e.items) || 0;
  st.lastCheck = { at, n: e.n, msgId: e.msgId ?? null };
  st.lastFormat = e.format === 'open' ? 'open' : 'mc';
  if (mk) st.lastQuizMark = mk;
}

function applyEnd(st: SessionState, k: Clock, t: number): void {
  if (k.endMs != null) return; // already ended: a second end changes nothing
  k.endMs = t;
  k.endBreak = st.onBreak;
  k.endPaused = st.paused;
  if (st.onBreak) endBreak(st, k, t);
  if (st.paused) endPause(st, k, t);
}

/** Undo of an end: the time it stood ended is not study time, and every clock picks up where it stopped. */
function applyReopen(st: SessionState, k: Clock, t: number): void {
  if (k.endMs == null) return;
  const gap = Math.max(0, t - k.endMs);
  k.breakMs += gap;
  if (k.next != null && !k.endBreak) k.next += gap;
  if (k.endBreak) {
    st.onBreak = true;
    k.breakAt = t;
  }
  if (k.endPaused) {
    st.paused = true; // reopened as it was ended: paused until he writes
    k.pauseAt = t;
  }
  if (!k.endBreak && !k.endPaused) k.since = t;
  k.endMs = null;
  k.endBreak = false;
  k.endPaused = false;
}

function applyEvent(st: SessionState, k: Clock, e: SessionEvent, at: string, c: SessionRules): void {
  const t = toMs(at);
  const step = c.checkMinutes * 60e3;
  switch (e.type) {
    case 'start':
      if (e.len != null) st.lastMark = st.lastQuizMark = markOf(e);
      break;
    case 'check':
      applyCheck(st, k, e, at, t, step);
      break;
    case 'idle':
      st.idleChecks++;
      k.next = t + step;
      k.span = step;
      break;
    case 'skip': // the check couldn't run: no note yet
      k.next = t + step;
      k.span = step;
      break;
    case 'pause':
      // from his last keystroke (e.from, else when it was written), never before the clock last started
      if (st.writing && !st.paused && !st.onBreak && k.endMs == null) {
        const from = Number.isFinite(toMs(e.from)) ? Math.min(toMs(e.from), t) : t;
        st.paused = true;
        k.pauseAt = Math.max(from, Number.isFinite(k.since) ? k.since : from);
        k.remaining = Math.max(0, (k.next ?? k.pauseAt) - k.pauseAt);
      }
      break;
    case 'write':
      if (st.paused && k.endMs == null) {
        endPause(st, k, t);
        k.next = t + Math.max(k.remaining, c.minResumeSeconds * 1e3);
        k.since = t;
      }
      break;
    case 'break':
      if (st.paused) {
        // a break taken while paused: the pause ends where the break starts, and the break holds what it held
        endPause(st, k, t);
        st.onBreak = true;
        k.breakAt = t;
      } else if (!st.onBreak) {
        st.onBreak = true;
        k.breakAt = t;
        k.remaining = Math.max(0, (k.next ?? t) - t);
      }
      break;
    case 'resume':
      if (st.onBreak) {
        endBreak(st, k, t);
        k.next = t + Math.max(k.remaining, c.minResumeSeconds * 1e3);
        k.since = t;
      }
      break;
    case 'extend': {
      const add = (Number(e.minutes) || c.extendMinutes) * 60e3;
      if (st.onBreak) k.remaining += add;
      else k.next = (k.next ?? t) + add;
      k.span += add;
      if (k.plannedMs != null) k.plannedMs += add; // +5 lengthens a timed session too
      break;
    }
    case 'answer':
      st.answered[e.n as number] = e.msgId || true;
      break;
    case 'end':
      applyEnd(st, k, t);
      break;
    case 'reopen':
      applyReopen(st, k, t);
      break;
  }
}

function initial(s: SessionDoc | null, t0: number, step: number): { st: SessionState; k: Clock } {
  const writing = s?.clock === 'writing';
  const st: SessionState = {
    status: s?.status ?? 'active',
    onBreak: false,
    nextCheckAt: null,
    breakRemainingMs: 0,
    due: false,
    checks: 0,
    questions: 0,
    comments: 0,
    reads: 0,
    idleChecks: 0,
    shouldWrap: false,
    lastCheck: null,
    lastFormat: null,
    lastMark: null,
    lastQuizMark: null,
    answered: {},
    minutes: 0,
    overdueMs: 0,
    toCheck: 0,
    writing,
    paused: false,
    pausedAt: null,
    activeMs: 0,
    activeSince: null,
    planned: null,
    leftMs: null,
    breakStartedAt: null,
    timeUp: false,
  };
  const k: Clock = {
    next: Number.isFinite(t0) ? t0 + step : null,
    span: step,
    breakAt: null,
    remaining: 0,
    breakMs: 0,
    endMs: null,
    endBreak: false,
    endPaused: false,
    pauseAt: null,
    pauseMs: 0,
    since: t0,
    plannedMs: !writing && Number(s?.planned) > 0 ? Number(s?.planned) * 60e3 : null,
  };
  return { st, k };
}

/**
 * Rebuilds a session's clock and counts from its events (the legacy sessionState). A check is a quiz (counted), a comment or
 * a quiet checkpoint; all three move the note's mark. A timed session runs `planned` minutes and +5 adds to it. A
 * session with clock 'writing' counts only the time he spends writing: a pause event stops the clock and holds the
 * check clock as a break does, a write event starts both again, and it wraps only after writingWrapMinutes paused.
 */
export function sessionState(
  s: SessionDoc | null,
  now?: string | number,
  rules: SessionRules = SESSION_RULES
): SessionState {
  const c = rules;
  const step = c.checkMinutes * 60e3;
  const t0 = toMs(s?.startedAt);
  const nowMs = toMs(now == null ? new Date().toISOString() : now);
  const { st, k } = initial(s, t0, step);
  const evs = Object.entries(s?.events ?? {})
    .filter(([, e]) => e?.type)
    .map(([key, e]) => [entryTime(key, e), e] as const)
    .filter(([t]) => Number.isFinite(toMs(t)))
    .sort(([a], [b]) => toMs(a) - toMs(b));
  for (const [at, e] of evs) applyEvent(st, k, e, at, c);
  const until = k.endMs ?? (Number.isFinite(toMs(s?.endedAt)) ? toMs(s?.endedAt) : nowMs);
  if (st.onBreak && k.breakAt != null) k.breakMs += Math.max(0, until - k.breakAt);
  if (st.paused && k.pauseAt != null) k.pauseMs += Math.max(0, until - k.pauseAt);
  st.activeMs = Number.isFinite(t0) ? Math.max(0, until - t0 - k.breakMs - k.pauseMs) : 0;
  st.pausedAt = st.paused && k.pauseAt != null ? iso(k.pauseAt) : null;
  st.activeSince = Number.isFinite(k.since) ? iso(k.since) : null;
  st.minutes = Math.round(st.activeMs / 60000);
  st.planned = k.plannedMs != null ? Math.round(k.plannedMs / 60e3) : null;
  st.leftMs = k.plannedMs != null ? Math.max(0, k.plannedMs - st.activeMs) : null;
  st.breakStartedAt = st.onBreak && k.breakAt != null ? iso(k.breakAt) : null;
  st.breakRemainingMs = st.onBreak ? k.remaining : 0;
  const running = st.status === 'active';
  st.nextCheckAt = running && !st.onBreak && !st.paused && k.next != null ? iso(k.next) : null;
  st.due = !!st.nextCheckAt && nowMs >= (k.next as number);
  st.overdueMs = st.due ? nowMs - (k.next as number) : 0;
  const left = st.onBreak || st.paused ? k.remaining : k.next == null ? k.span : k.next - nowMs;
  st.toCheck = running ? Math.max(0, Math.min(1, 1 - left / k.span)) : 0;
  // a timed session ends on its clock, not on idle checks; a writing session only once paused writingWrapMinutes
  st.shouldWrap = st.writing
    ? running && st.paused && nowMs - (k.pauseAt as number) >= c.writingWrapMinutes * 60e3
    : running && k.plannedMs == null && st.idleChecks >= c.idleChecksToEnd;
  st.timeUp = running && k.plannedMs != null && !st.onBreak && (st.leftMs as number) <= 0;
  return st;
}
