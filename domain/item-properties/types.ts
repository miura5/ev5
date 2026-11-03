import type { Repeat } from '../time/index.ts';

/** An item_props row (PLAN §5.10): time, repeat, linked item and overrides for one item; `c`/`id` name the item. */
export type ItemProps = {
  c: string;
  id: string;
  /** Central wall time 'HH:MM', or null. */
  time: string | null;
  repeat: Repeat | null;
  linkedC: string | null;
  linkedId: string | null;
  /** Overrides for morning-made items (ev4 has no override field), keyed by field name. */
  overrides: Record<string, string | number | boolean | null> | null;
  at: string;
  v: number;
};

/** What a repeat copies into each day: the plan item as ev4's `dayedits.added` entry holds it. */
export type PlanTemplate = {
  text: string;
  kind: 'todo' | 'reading' | 'learn' | 'practice' | 'review' | 'notes';
  minutes?: number;
  course?: string;
  tag?: string | null;
};

/** One occurrence to write into the dayedits document of `date` under `key` (ev4 `added` entry shape). */
export type Occurrence = {
  date: string;
  key: string;
  entry: PlanTemplate & { at: string; by: 'Matt' };
};
