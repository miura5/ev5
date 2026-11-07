import { occurrences, repeatKey } from '../time/index.ts';
import type { ItemProps, Occurrence, PlanTemplate } from './types.ts';

/**
 * Each day's occurrence of a repeating item from `from` through `to`, ready to write as a plan item under
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
