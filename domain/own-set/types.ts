import type { SetItem } from '../set/index.ts';

// PLAN §5.10: own_sets(id, title, type, source_c, source_id, at, v), own_set_items(set_id, item_id, pos, body JSON, at, v)
// and append-only own_attempts(set_id, item_id, key, at, body JSON). Only question sets now; cards and steps come later.
export const OWN_SET_TYPES = ['question'] as const;

export type OwnSet = {
  id: string;
  title: string;
  type: (typeof OWN_SET_TYPES)[number];
  /** The ev4 collection and id this set was copied from on first edit, or null when typed by hand. */
  sourceC: string | null;
  sourceId: string | null;
  at: string;
  v: number;
};

/** One item in an own set; the body is an ev4 set item (sets schema 3), so scoring and checks are shared. */
export type OwnSetItem = {
  setId: string;
  itemId: string;
  pos: number;
  body: SetItem;
  at: string;
  v: number;
};

/** What an attempt records: the options chosen (single, sata), one column per row (matrix), or a typed answer. */
export type AttemptBody = {
  chosen?: number[];
  value?: number;
  text?: string;
  correct?: boolean;
  score?: number;
};

/** One append-only attempt; no `v` because it is never rewritten (§data.append-only). */
export type OwnAttempt = {
  setId: string;
  itemId: string;
  key: string;
  at: string;
  body: AttemptBody;
};

/** The ev4 set left untouched and hidden once its copy exists. */
export type HiddenOriginal = { c: 'sets'; id: string };
