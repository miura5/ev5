// Weak spot document (schemas 1 and 2) and ev4's
// fixed-interval scheduler, ported unchanged from ev4 core/evcore.mjs (deriveWeakspot, applyEvent, isActive, isSolid,
// isDue, reviewNeed). Nothing derived is ever stored: state is rebuilt from the facts, the events and the answers.
import { z } from 'zod';

export const WEAK_SPOT_KINDS = ['concept', 'note', 'connection', 'format', 'skill'] as const;
export const EVENT_TYPES = [
  'park',
  'activate',
  'solid',
  'done',
  'move',
  'seen',
  'reopen',
  'accept',
  'snooze',
  'decline',
] as const;

const EVENT_KEY = /^[a-z][a-z-]*-\d{8}-\d{6}(\d{3})?(-[a-z0-9]+)?$/;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().min(0);
const text = z.string().min(1);
const SCHEMA_2_ONLY = ['accept', 'snooze', 'decline'];

export const weakSpotEventSchema = z
  .looseObject({
    type: z.enum(EVENT_TYPES),
    by: z.string().optional(),
    note: z.string().optional(),
    at: z.string().optional(),
    objective: z.string().optional(),
    until: z.string().optional(),
  })
  .refine((e) => e.type !== 'snooze' || date.safeParse(e.until).success, { message: 'snooze needs until' });
export type WeakSpotEvent = z.infer<typeof weakSpotEventSchema>;

export const weakSpotSchema = z
  .looseObject({
    schema: z.union([z.literal(1), z.literal(2)]),
    writer: z.enum(['page', 'morning', 'worker', 'filing']),
    at: text,
    source: text,
    topic: text,
    objective: z.string(),
    kind: z.enum(WEAK_SPOT_KINDS),
    initial: z.strictObject({
      streak: count.optional(),
      nextDue: date.nullable().optional(),
      recurrence: count.optional(),
      misses: count.optional(),
    }),
    events: z.record(z.string().regex(EVENT_KEY, 'bad event key'), weakSpotEventSchema),
    words: z.string().optional(),
    exam: z.string().nullable().optional(),
    course: z.string().optional(),
    proposed: z.boolean().optional(),
    addedBy: z.string().optional(),
    preRead: z.boolean().optional(),
    readingDue: date.nullable().optional(),
    links: z
      .array(
        z.looseObject({
          to: z.string(),
          type: z.string(),
          note: z.string().optional(),
          createdAt: z.string().optional(),
          createdBy: z.string().optional(),
        }),
      )
      .optional(),
    origin: z.unknown().optional(),
  })
  .superRefine((o, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: 'custom', message });
    if ('derived' in o || 'concept' in o) bad('derived state is never stored');
    if (o.schema === 1) {
      if ('proposed' in o || 'words' in o || 'links' in o) bad('field needs schema 2');
      if (Object.values(o.events).some((e) => SCHEMA_2_ONLY.includes(e.type))) bad('event needs schema 2');
    }
  });
export type WeakSpot = z.infer<typeof weakSpotSchema>;

/** An answer on this weak spot. `at` is an ISO instant; `matched` marks a different question missed on the topic. */
export type Attempt = {
  at: string;
  correct: boolean;
  matched?: boolean;
  created?: string;
};

export type Status = 'open' | 'reviewed' | 'parked' | 'moved' | 'proposed' | 'snoozed' | 'declined' | 'duplicate';

export type Derived = {
  status: Status;
  streak: number;
  nextDue: string | null;
  misses: number;
  recurrence: number;
  lastReviewed: string | null;
  lastResult: 'right' | 'wrong' | null;
  solidBy: string | null;
  solidAt: string | null;
  preRead: boolean;
  reopenedAt: string | null;
  answered: number;
  right: number;
  history: { date: string; correct: boolean }[];
  parkedReason?: string;
  snoozedUntil?: string | null;
  objective?: string;
  duplicateOf?: string;
};

/** ev4's review constants (spec.constants.review defaults). */
export type ReviewRules = {
  solidAfterRightDays: number;
  intervalDays: number;
  intervalNearExamDays: number;
  nearExamWithinDays: number;
};
export const REVIEW_RULES: ReviewRules = {
  solidAfterRightDays: 2,
  intervalDays: 3,
  intervalNearExamDays: 1,
  nearExamWithinDays: 5,
};
