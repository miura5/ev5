import { z } from 'zod';

/** What a draft is for, which names its home (PLAN §5.10). */
export const DRAFT_KINDS = ['set-item', 'plan-item', 'set-save'] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const DRAFT_STATES = ['pending', 'kept', 'dropped'] as const;
export type DraftState = (typeof DRAFT_STATES)[number];

/** A drafts row: `drafts(id, job_id, kind, target_c, target_id, body JSON, state, at, v)`; snake_case columns are camelCase here. */
export const draftSchema = z.strictObject({
  id: z.string().min(1),
  jobId: z.string().min(1),
  kind: z.enum(DRAFT_KINDS),
  /** The collection the draft is aimed at: own_sets, dayedits or sets. */
  targetC: z.string().min(1),
  /** The row it is aimed at: a set id, or a date for a plan item. */
  targetId: z.string().min(1),
  body: z.record(z.string(), z.unknown()),
  state: z.enum(DRAFT_STATES),
  at: z.string().min(1),
  v: z.number().int().min(1),
});
export type Draft = z.infer<typeof draftSchema>;

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
