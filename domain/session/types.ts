// Study session document (ev4 sessions schema 2, frozen in data/compat/schemas/sessions.schema.json). The note's
// text never enters a session: only its length and hash. State is rebuilt from the events map, never stored.
export const EVENT_TYPES = [
  'start',
  'check',
  'idle',
  'skip',
  'break',
  'resume',
  'extend',
  'answer',
  'end',
  'step',
  'reopen',
  'pause',
  'write',
] as const;
export const STATUSES = ['active', 'ending', 'ended', 'discarded'] as const;

export type SessionEvent = {
  type: (typeof EVENT_TYPES)[number];
  at?: string;
  len?: number;
  h?: string;
  n?: number;
  result?: 'pass' | 'miss';
  format?: 'mc' | 'open';
  noteId?: string;
  modifiedAt?: string;
  msgId?: string;
  items?: number;
  comment?: boolean;
  quiet?: boolean;
  minutes?: number;
  from?: string;
  why?: string;
  view?: string;
};

/** The fields of a session document that the clock, the filing and Undo read; the rest pass through unread. */
export type Session = {
  schema: 2;
  writer: 'page' | 'filing';
  at: string;
  source: 'Study Watch' | 'E.V. Home';
  date: string;
  status?: (typeof STATUSES)[number];
  kind?: 'note' | 'skill';
  startedAt?: string | null;
  endedAt?: string | null;
  topic?: string;
  noteId?: string;
  note?: string;
  planned?: number;
  clock?: 'writing';
  folder?: string;
  events?: Record<string, SessionEvent>;
  driver?: { view: string; at: string } | null;
  minutes?: number | null;
  checks?: number | unknown[] | null;
  questions?: number | unknown[] | null;
  endedBy?: string | null;
  summary?: string;
  filedAt?: string;
  filing?: { at: string; wrap: object } | null;
  comments?: 'more' | 'some' | 'off';
  pending?: object | null;
};

/** A session as the pure functions read it: its id beside the document's fields. */
export type SessionDoc = Partial<Session> & { id: string };

/** A write the page makes to the sessions collection (`update` merges the fields into the document). */
export type SessionWrite = { op: 'set' | 'update'; collection: 'sessions'; id: string; data: Record<string, unknown> };

/** ev4's Study Watch constants (spec.constants.studyWatch defaults) that the session clock and read-along use. */
export type SessionRules = {
  checkMinutes: number;
  idleChecksToEnd: number;
  extendMinutes: number;
  minResumeSeconds: number;
  fallbackChars: number;
  commentMinChars: number;
  commentGapSeconds: number;
  readAlongIdleMinutes: number;
  writingWrapMinutes: number;
};
export const SESSION_RULES: SessionRules = {
  checkMinutes: 7,
  idleChecksToEnd: 3,
  extendMinutes: 5,
  minResumeSeconds: 30,
  fallbackChars: 2500,
  commentMinChars: 20,
  commentGapSeconds: 75,
  readAlongIdleMinutes: 10,
  writingWrapMinutes: 60,
};

export type Mark = { noteId: string | null; len: number; h?: string; modifiedAt: string | null };
