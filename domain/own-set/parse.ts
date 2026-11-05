import { validateItem } from '../item/index.ts';
import {
  ownAttemptSchema,
  ownSetItemSchema,
  ownSetSchema,
  type OwnAttempt,
  type OwnSet,
  type OwnSetItem,
} from './types.ts';

/** Validates an own_sets row. */
export function parseOwnSet(raw: unknown): OwnSet {
  return ownSetSchema.parse(raw);
}

/** Errors that make an item body unusable (a set item); a missing rationale is only a warning, so Matt's drafts pass. */
export function itemBodyErrors(body: unknown): string[] {
  return validateItem(body).errors;
}

/** Validates an own_set_items row, including its item body. */
export function parseOwnSetItem(raw: unknown): OwnSetItem {
  const o = ownSetItemSchema.parse(raw);
  const errors = itemBodyErrors(o.body);
  if (errors.length) throw new Error(`own set item ${o.itemId}: ${errors.join('; ')}`);
  if (o.body.id !== o.itemId) throw new Error('own set item: body id differs from itemId');
  return o;
}

/** Validates an own_attempts row. */
export function parseOwnAttempt(raw: unknown): OwnAttempt {
  return ownAttemptSchema.parse(raw);
}
