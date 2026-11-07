import { z } from 'zod';
import type { SetItem } from '../set/index.ts';

const text = z.string().min(1);
const version = z.number().int().min(1);

// PLAN §5.10: own_sets(id, title, type, source_c, source_id, at, v), own_set_items(set_id, item_id, pos, body JSON, at, v)
// and append-only own_attempts(set_id, item_id, key, at, body JSON). Only question sets now; cards and steps come later.
export const OWN_SET_TYPES = ['question'] as const;

/** A copy names its legacy source (both fields) and a hand-typed set names neither. */
export const ownSetSchema = z
  .strictObject({
    id: text,
    title: text,
    type: z.enum(OWN_SET_TYPES),
    /** The legacy collection and id this set was copied from on first edit, or null when typed by hand. */
    sourceC: text.nullable(),
    sourceId: text.nullable(),
    at: text,
    v: version,
  })
  .refine((o) => (o.sourceC === null) === (o.sourceId === null), 'sourceC and sourceId go together');
export type OwnSet = z.infer<typeof ownSetSchema>;

/** One item in an own set; the body is a legacy set item (sets schema 3), so scoring and checks are shared. */
export const ownSetItemSchema = z.strictObject({
  setId: text,
  itemId: text,
  pos: z.number().finite(),
  body: z.custom<SetItem>((v) => typeof v === 'object' && v !== null && !Array.isArray(v), 'bad body'),
  at: text,
  v: version,
});
export type OwnSetItem = z.infer<typeof ownSetItemSchema>;

/** What an attempt records: the options chosen (single, multi_select), one column per row (grid), or a typed answer. */
export const attemptBodySchema = z
  .strictObject({
    chosen: z.array(z.number().int().min(0)).optional(),
    value: z.number().finite().optional(),
    text: z.string().optional(),
    correct: z.boolean().optional(),
    score: z.number().min(0).max(1).optional(),
  })
  .refine((b) => b.chosen !== undefined || b.value !== undefined || b.text !== undefined, 'an answer is required');
export type AttemptBody = z.infer<typeof attemptBodySchema>;

/** One append-only attempt; no `v` because it is never rewritten (§data.append-only). */
export const ownAttemptSchema = z.strictObject({
  setId: text,
  itemId: text,
  key: text,
  at: text,
  body: attemptBodySchema,
});
export type OwnAttempt = z.infer<typeof ownAttemptSchema>;

/** The legacy set left untouched and hidden once its copy exists. */
export type HiddenOriginal = { c: 'sets'; id: string };
