import { occurrences, repeatKey } from '../time/index.ts';
import type { ItemProps, Occurrence, PlanTemplate } from './types.ts';

/**
 * Each day's occurrence of a repeating item from `from` through `to`, ready to write into dayedits.added under
 * `rep-<id>-<date>`. Nothing for an item without a repeat. `at` stamps the entries; they are Matt's own plan items.
 */
export function materialize(props: ItemProps, plan: PlanTemplate, from: string, to: string, at: string): Occurrence[] {
  if (!props.repeat) return [];
  return occurrences(props.repeat, from, to).map((date) => ({
    date,
    key: repeatKey(props.id, date),
    entry: { ...plan, at, by: 'Matt' },
  }));
}

/** What one day's dayedits doc holds that matters here. */
export type DayDoc = {
  added?: Record<string, unknown>;
  skipped?: Record<string, unknown>;
};

/**
 * The occurrences of one day still to add. Idempotent: a key already in `added` is left as it is (Matt's edits to it
 * stay), and a key in `skipped` is not brought back, so re-running after a restore adds no duplicates.
 */
export function missingOccurrences(day: DayDoc | null, found: readonly Occurrence[]): Occurrence[] {
  return found.filter((o) => !(day?.added && o.key in day.added) && !(day?.skipped && o.key in day.skipped));
}
