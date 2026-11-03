import { validateItem } from '../item/index.ts';
import type { SetItem } from '../set/index.ts';
import { OWN_SET_TYPES, type AttemptBody, type OwnAttempt, type OwnSet, type OwnSetItem } from './types.ts';

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const version = (v: unknown) => Number.isInteger(v) && (v as number) >= 1;

function shape(name: string, raw: unknown, keys: string[]): Record<string, unknown> {
  if (!isObj(raw)) throw new Error(`${name}: not an object`);
  for (const k of Object.keys(raw)) if (!keys.includes(k)) throw new Error(`${name}: unexpected field ${k}`);
  return raw;
}

/** Validates an own_sets row. A copy names its ev4 source (both fields) and a hand-typed set names neither. */
export function parseOwnSet(raw: unknown): OwnSet {
  const o = shape('own set', raw, ['id', 'title', 'type', 'sourceC', 'sourceId', 'at', 'v']);
  if (!str(o.id) || !str(o.title) || !str(o.at)) throw new Error('own set: id, title and at are required');
  if (!(OWN_SET_TYPES as readonly unknown[]).includes(o.type)) throw new Error('own set: bad type');
  if ((o.sourceC === null) !== (o.sourceId === null) || (o.sourceC !== null && !(str(o.sourceC) && str(o.sourceId))))
    throw new Error('own set: sourceC and sourceId go together');
  if (!version(o.v)) throw new Error('own set: bad v');
  return o as OwnSet;
}

/** Errors that make an item body unusable (an ev4 set item); a missing rationale is only a warning, so Matt's drafts pass. */
export function itemBodyErrors(body: unknown): string[] {
  return validateItem(body).errors;
}

/** Validates an own_set_items row, including its item body. */
export function parseOwnSetItem(raw: unknown): OwnSetItem {
  const o = shape('own set item', raw, ['setId', 'itemId', 'pos', 'body', 'at', 'v']);
  if (!str(o.setId) || !str(o.itemId) || !str(o.at)) throw new Error('own set item: setId, itemId and at are required');
  if (typeof o.pos !== 'number' || !Number.isFinite(o.pos)) throw new Error('own set item: bad pos');
  if (!version(o.v)) throw new Error('own set item: bad v');
  const errors = itemBodyErrors(o.body);
  if (errors.length) throw new Error(`own set item ${o.itemId}: ${errors.join('; ')}`);
  if ((o.body as SetItem).id !== o.itemId) throw new Error('own set item: body id differs from itemId');
  return o as OwnSetItem;
}

function parseBody(b: unknown): AttemptBody {
  const o = shape('own attempt body', b, ['chosen', 'value', 'text', 'correct', 'score']);
  if (o.chosen !== undefined && !(Array.isArray(o.chosen) && o.chosen.every((n) => Number.isInteger(n) && n >= 0)))
    throw new Error('own attempt: bad chosen');
  if (o.value !== undefined && !(typeof o.value === 'number' && Number.isFinite(o.value)))
    throw new Error('own attempt: bad value');
  if (o.text !== undefined && typeof o.text !== 'string') throw new Error('own attempt: bad text');
  if (o.correct !== undefined && typeof o.correct !== 'boolean') throw new Error('own attempt: bad correct');
  if (o.score !== undefined && !(typeof o.score === 'number' && o.score >= 0 && o.score <= 1))
    throw new Error('own attempt: bad score');
  if (o.chosen === undefined && o.value === undefined && o.text === undefined)
    throw new Error('own attempt: an answer is required');
  return o as AttemptBody;
}

/** Validates an own_attempts row. */
export function parseOwnAttempt(raw: unknown): OwnAttempt {
  const o = shape('own attempt', raw, ['setId', 'itemId', 'key', 'at', 'body']);
  if (!str(o.setId) || !str(o.itemId) || !str(o.key) || !str(o.at)) throw new Error('own attempt: bad field');
  parseBody(o.body);
  return o as OwnAttempt;
}
