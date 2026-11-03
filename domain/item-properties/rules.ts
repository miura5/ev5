import { occurrences, repeatKey } from '../time/index.ts';
import type { ItemProps, Occurrence, PlanTemplate } from './types.ts';

/**
 * The occurrences of a props row's repeat from `from` to `to` that are not yet stored. `have(date, key)` says whether
 * dayedits.added of that date already holds the key, so running this again after a write or a restore adds nothing
 * (§data.repeat). A row with no repeat has none.
 */
export function materialize(
  props: ItemProps,
  template: PlanTemplate,
  from: string,
  to: string,
  have: (date: string, key: string) => boolean,
  at: string,
): Occurrence[] {
  if (!props.repeat) return [];
  const out: Occurrence[] = [];
  for (const date of occurrences(props.repeat, from, to)) {
    const key = repeatKey(props.id, date);
    if (!have(date, key)) out.push({ date, key, entry: { ...template, at, by: 'Matt' } });
  }
  return out;
}

/** Rows whose linked item does not resolve: reported, never dropped (§data.links). */
export function unresolvedLinks(rows: readonly ItemProps[], exists: (c: string, id: string) => boolean): string[] {
  return rows
    .filter((r) => r.linkedC !== null && r.linkedId !== null && !exists(r.linkedC, r.linkedId))
    .map((r) => `${r.c}/${r.id}: linked ${r.linkedC}/${r.linkedId} does not exist`);
}

/** A field with an override on a morning-made item shows the override; otherwise the item's own value. */
export function overridden<T>(
  props: ItemProps | undefined,
  field: string,
  own: T,
): T | string | number | boolean | null {
  const o = props?.overrides;
  return o && field in o ? (o[field] as string | number | boolean | null) : own;
}
