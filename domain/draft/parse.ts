import { draftSchema, type Draft } from './types.ts';

/** Validates a drafts row; throws on a missing, extra or malformed field. */
export function parseDraft(raw: unknown): Draft {
  return draftSchema.parse(raw);
}
