import type { Repeat } from '../time/index.ts';

/** The item an item_props row points at: a collection name and an id. */
export type Linked = { c: string; id: string };

/** Overrides for a morning-made item (ev4 has no override field): flat JSON scalars by field name. */
export type Overrides = Record<string, string | number | boolean | null>;

/** An item_props row (PLAN §5.10 `item_props(c, id, time, repeat, linked_c, linked_id, overrides, at, v)`). */
export type ItemProps = {
  c: string;
  id: string;
  /** 'HH:MM' Central wall time, or null. */
  time: string | null;
  repeat: Repeat | null;
  linked: Linked | null;
  overrides: Overrides | null;
  at: string;
  v: number;
};

/** The ev4 kinds an added plan item may have (dayedits schema 1). */
export type AddedKind =
  | 'todo'
  | 'reading'
  | 'learn'
  | 'practice'
  | 'review'
  | 'notes'
  | 'graded'
  | 'skills-prep'
  | 'clinical-prep';

/** What a repeating plan item looks like each day: ev4's `added` entry minus `at` and `by`. */
export type PlanTemplate = {
  text: string;
  kind: AddedKind;
  minutes?: number;
  course?: string;
  tag?: string | null;
};

/** One entry of ev4's dayedits `added` map (by is always Matt: a repeat is his own plan item). */
export type AddedEntry = PlanTemplate & { at: string; by: 'Matt' };

/** One day's occurrence ready to be written under `rep-<id>-<date>`. */
export type Occurrence = { date: string; key: string; entry: AddedEntry };
