// The v5 `drafts` row (table design 2.14): the kept table gets a `draft_` id and `target_c` becomes `target_kind`.
import { z } from 'zod';
import { ms, prefixed, text } from '../table-row/index.ts';
import { DRAFT_KINDS, DRAFT_STATES } from './types.ts';

export const draftTableSchema = z.strictObject({
  id: prefixed('draft_'),
  job_id: text,
  kind: z.enum(DRAFT_KINDS),
  /** The kind of row the draft is aimed at (was `target_c`): own_sets, dayedits or sets until those kinds move. */
  target_kind: text,
  target_id: text,
  body: z.record(z.string(), z.unknown()),
  state: z.enum(DRAFT_STATES),
  at: ms,
  v: z.number().int().min(1),
});

/** A draft's id on the drafts table: the same rule with `draft_`, so callers may name a draft by its bare id. */
export const draftKey = (id: string): string => (id.startsWith('draft_') ? id : `draft_${id}`);

export const parseDraftTableRow = (raw: unknown) => draftTableSchema.parse(raw);
