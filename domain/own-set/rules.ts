import { itemType, scoreAnswer } from '../item/index.ts';
import type { SetAnswers, SetItem, StudySet } from '../set/index.ts';
import { itemBodyErrors } from './parse.ts';
import type { AttemptBody, HiddenOriginal, OwnAttempt, OwnSet, OwnSetItem } from './types.ts';

type OwnSetCopy = { set: OwnSet; items: OwnSetItem[]; hide: HiddenOriginal };

/**
 * Copy-on-first-edit (ev4-era; replaced by §data.item-versions): an ev4 set becomes an own set with the same item ids and order. The original
 * and its answers are untouched; the caller writes the copy, hides the original and starts fresh own attempts.
 */
export function copyOnFirstEdit(original: StudySet, sourceId: string, newId: string, now: string): OwnSetCopy {
  const set: OwnSet = {
    id: newId,
    title: original.title ?? sourceId,
    type: 'question',
    sourceC: 'sets',
    sourceId,
    at: now,
    v: 1,
  };
  const items = original.items.map((body, i) => ({
    setId: newId,
    itemId: body.id,
    pos: i + 1,
    body,
    at: now,
    v: 1,
  }));
  return { set, items, hide: { c: 'sets', id: sourceId } };
}

/** Items in order (position, then id for a tie). */
export function orderedItems(items: OwnSetItem[]): OwnSetItem[] {
  return [...items].sort((a, b) => a.pos - b.pos || a.itemId.localeCompare(b.itemId));
}

/** Adds an item at the end, or throws when the body is unusable or the id is taken. */
export function addItem(items: OwnSetItem[], setId: string, body: SetItem, now: string): OwnSetItem[] {
  const errors = itemBodyErrors(body);
  if (errors.length) throw new Error(`item ${body.id}: ${errors.join('; ')}`);
  if (items.some((i) => i.itemId === body.id)) throw new Error(`item ${body.id}: already in the set`);
  const pos = items.reduce((m, i) => Math.max(m, i.pos), 0) + 1;
  return [...items, { setId, itemId: body.id, pos, body, at: now, v: 1 }];
}

/** Replaces an item's body (its id stays) and bumps `v`; throws when the item is missing or the body is unusable. */
export function updateItem(items: OwnSetItem[], itemId: string, body: SetItem, now: string): OwnSetItem[] {
  if (body.id !== itemId) throw new Error('item: the id cannot change');
  const errors = itemBodyErrors(body);
  if (errors.length) throw new Error(`item ${itemId}: ${errors.join('; ')}`);
  if (!items.some((i) => i.itemId === itemId)) throw new Error(`item ${itemId}: not in the set`);
  return items.map((i) => (i.itemId === itemId ? { ...i, body, at: now, v: i.v + 1 } : i));
}

/** Removes an item from the list. Its attempts are never removed (§data.append-only); they simply show no item. */
export function deleteItem(items: OwnSetItem[], itemId: string): OwnSetItem[] {
  return items.filter((i) => i.itemId !== itemId);
}

/** The attempt key for the nth try at an item (1-based): `a1`, `a2`... */
export function nextAttemptKey(attempts: OwnAttempt[], setId: string, itemId: string): string {
  return `a${attempts.filter((a) => a.setId === setId && a.itemId === itemId).length + 1}`;
}

/** Scores an attempt at a single, select-all or matrix item; other types are graded by their own rules. */
export function attemptBody(item: SetItem, chosen: number[]): AttemptBody {
  const t = itemType(item);
  if (t !== 'single' && t !== 'sata' && t !== 'matrix') throw new Error(`attempt: ${t} items are graded elsewhere`);
  return { chosen, ...scoreAnswer(item, chosen) };
}

/** Appends an attempt; a key already used for that item is refused, so nothing is ever rewritten. */
export function appendAttempt(attempts: OwnAttempt[], next: OwnAttempt): OwnAttempt[] {
  if (attempts.some((a) => a.setId === next.setId && a.itemId === next.itemId && a.key === next.key))
    throw new Error(`attempt ${next.key}: already recorded`);
  return [...attempts, next];
}

/** Own attempts in the shape of the answers collection (item id -> key -> attempt), so weak-spot derivation reads both. */
export function attemptsAsAnswers(attempts: OwnAttempt[], setId: string): SetAnswers {
  const out: SetAnswers = {};
  for (const a of attempts) {
    if (a.setId !== setId) continue;
    const row = (out[a.itemId] ??= {});
    row[a.key] = a.body.correct === undefined ? { at: a.at } : { at: a.at, correct: a.body.correct };
  }
  return out;
}

/** An own set is done once every current item has an attempt; a retry never undoes it. */
export function ownSetDone(items: OwnSetItem[], attempts: OwnAttempt[]): boolean {
  const tried = new Set(attempts.map((a) => a.itemId));
  return items.length > 0 && items.every((i) => tried.has(i.itemId));
}

/** What export and restore must show: sets, items and attempts that do not line up (reported, never dropped). */
export function ownSetProblems(sets: OwnSet[], items: OwnSetItem[], attempts: OwnAttempt[]): string[] {
  const out: string[] = [];
  const ids = new Set(sets.map((s) => s.id));
  const seen = new Set<string>();
  const pos = new Set<string>();
  for (const i of items) {
    const k = `${i.setId}/${i.itemId}`;
    if (!ids.has(i.setId)) out.push(`${k}: set does not exist`);
    if (seen.has(k)) out.push(`${k}: listed twice`);
    seen.add(k);
  }
  for (const i of items) {
    const k = `${i.setId}@${i.pos}`;
    if (pos.has(k)) out.push(`${k}: two items share a position`);
    pos.add(k);
  }
  for (const a of attempts) if (!ids.has(a.setId)) out.push(`${a.setId}/${a.itemId}/${a.key}: attempt has no set`);
  return out;
}
