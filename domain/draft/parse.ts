import { DRAFT_KINDS, DRAFT_STATES, type Draft } from './types.ts';

const KEYS = ['id', 'jobId', 'kind', 'targetC', 'targetId', 'body', 'state', 'at', 'v'];
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates a drafts row; throws on a missing, extra or malformed field. */
export function parseDraft(raw: unknown): Draft {
  if (!isObj(raw)) throw new Error('draft: not an object');
  for (const k of Object.keys(raw)) if (!KEYS.includes(k)) throw new Error(`draft: unexpected field ${k}`);
  if (!str(raw.id) || !str(raw.jobId) || !str(raw.targetC) || !str(raw.targetId) || !str(raw.at)) {
    throw new Error('draft: id, jobId, targetC, targetId and at are required');
  }
  if (!(DRAFT_KINDS as readonly unknown[]).includes(raw.kind)) throw new Error('draft: bad kind');
  if (!(DRAFT_STATES as readonly unknown[]).includes(raw.state)) throw new Error('draft: bad state');
  if (!isObj(raw.body)) throw new Error('draft: body must be an object');
  if (!Number.isInteger(raw.v) || (raw.v as number) < 1) throw new Error('draft: bad v');
  return raw as Draft;
}
