// Weak spot document (ev4 weakspots schema 1 and 2, frozen in data/compat/schemas/weakspots.schema.json) and ev4's
// fixed-interval scheduler, ported unchanged from ev4 core/evcore.mjs (deriveWeakspot, applyEvent, isActive, isSolid,
// isDue, reviewNeed). Nothing derived is ever stored: state is rebuilt from the facts, the events and the answers.
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

export type WeakSpotEvent = {
  type: (typeof EVENT_TYPES)[number];
  by?: string;
  note?: string;
  at?: string;
  objective?: string;
  until?: string;
};

export type WeakSpot = {
  schema: 1 | 2;
  writer: 'page' | 'morning' | 'worker' | 'filing';
  at: string;
  source: string;
  topic: string;
  objective: string;
  kind: (typeof WEAK_SPOT_KINDS)[number];
  initial: {
    streak?: number;
    nextDue?: string | null;
    recurrence?: number;
    misses?: number;
  };
  events: Record<string, WeakSpotEvent>;
  words?: string;
  exam?: string | null;
  course?: string;
  proposed?: boolean;
  addedBy?: string;
  preRead?: boolean;
  readingDue?: string | null;
  links?: {
    to: string;
    type: string;
    note?: string;
    createdAt?: string;
    createdBy?: string;
  }[];
  origin?: unknown;
};

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
