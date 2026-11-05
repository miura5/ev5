import { z } from 'zod';

// Study session document (schema 2). The note's
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

const EVENT_KEY = /^[a-z][a-z-]*-\d{8}-\d{6}(\d{3})?(-[a-z0-9]+)?$/;
const NOTE = /^notes\/n-[A-Za-z0-9-]{1,120}$/;

const sessionEventSchema = z.looseObject({
  type: z.enum(EVENT_TYPES),
  at: z.string().optional(),
  len: z.number().int().min(0).optional(),
  h: z.string().optional(),
  n: z.number().optional(),
  result: z.enum(['pass', 'miss']).optional(),
  format: z.enum(['mc', 'open']).optional(),
  noteId: z.string().optional(),
  modifiedAt: z.string().optional(),
  msgId: z.string().optional(),
  items: z.number().optional(),
  comment: z.boolean().optional(),
  quiet: z.boolean().optional(),
  minutes: z.number().optional(),
  from: z.string().optional(),
  why: z.string().optional(),
  view: z.string().optional(),
});
export type SessionEvent = z.infer<typeof sessionEventSchema>;

const obj = z.looseObject({});

/**
 * The fields of a session document that the clock, the filing and Undo read; the rest pass through unread. The note's
 * text is refused: only its length and hash enter a session.
 */
export const sessionSchema = z
  .looseObject({
    schema: z.literal(2),
    writer: z.enum(['page', 'filing']),
    at: z.string().min(1),
    source: z.enum(['Study Watch', 'E.V. Home']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(STATUSES).optional(),
    kind: z.enum(['note', 'skill']).optional(),
    startedAt: z.string().nullable().optional(),
    endedAt: z.string().nullable().optional(),
    topic: z.string().optional(),
    noteId: z.string().optional(),
    note: z.string().regex(NOTE).optional(),
    planned: z.number().int().min(1).max(600).optional(),
    clock: z.literal('writing').optional(),
    folder: z.string().optional(),
    events: z.record(z.string().regex(EVENT_KEY, 'bad event key'), sessionEventSchema).optional(),
    driver: z.looseObject({ view: z.string(), at: z.string() }).nullable().optional(),
    minutes: z.number().nullable().optional(),
    checks: z
      .union([z.number(), z.array(z.unknown())])
      .nullable()
      .optional(),
    questions: z
      .union([z.number(), z.array(z.unknown())])
      .nullable()
      .optional(),
    endedBy: z.string().nullable().optional(),
    summary: z.string().optional(),
    filedAt: z.string().optional(),
    filing: z.looseObject({ at: z.string(), wrap: obj }).nullable().optional(),
    comments: z.enum(['more', 'some', 'off']).optional(),
    pending: obj.nullable().optional(),
  })
  .refine((o) => !('text' in o || 'noteText' in o), 'the note text never enters a session');
export type Session = z.infer<typeof sessionSchema>;

/** A session as the pure functions read it: its id beside the document's fields. */
export type SessionDoc = Partial<Session> & { id: string };

/** A write the page makes to the sessions collection (`update` merges the fields into the document). */
export type SessionWrite = {
  op: 'set' | 'update';
  collection: 'sessions';
  id: string;
  data: Record<string, unknown>;
};

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

export type Mark = {
  noteId: string | null;
  len: number;
  h?: string;
  modifiedAt: string | null;
};
