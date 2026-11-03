/** What a draft is for, which names its home (PLAN §5.10). */
export const DRAFT_KINDS = ['set-item', 'plan-item', 'set-save'] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const DRAFT_STATES = ['pending', 'kept', 'dropped'] as const;
export type DraftState = (typeof DRAFT_STATES)[number];

/** A drafts row: `drafts(id, job_id, kind, target_c, target_id, body JSON, state, at, v)`; snake_case columns are camelCase here. */
export type Draft = {
  id: string;
  jobId: string;
  kind: DraftKind;
  /** The collection the draft is aimed at: own_sets, dayedits or sets. */
  targetC: string;
  /** The row it is aimed at: a set id, or a date for a plan item. */
  targetId: string;
  body: Record<string, unknown>;
  state: DraftState;
  at: string;
  v: number;
};

/** One write in a keep batch. */
export type DraftWrite =
  /** Creates the copy under a key derived from the draft, so replaying the batch cannot make a second copy. */
  | { op: 'insert'; c: string; id: string; body: Record<string, unknown> }
  /** Marks the draft; applies only if the stored version is still `expectV` (the `docs` protocol). */
  | {
      op: 'mark';
      c: 'drafts';
      id: string;
      state: DraftState;
      expectV: number;
      at: string;
    };

/** The writes that must land together or not at all. */
export type DraftBatch = { atomic: true; writes: DraftWrite[] };
