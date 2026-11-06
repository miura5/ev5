import { z } from 'zod';
import { addDays } from '../time/index.ts';

const text = z.string().min(1);
const date = z.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v, 'not a date');

const repeatSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('daily') }),
  z.strictObject({ kind: z.literal('weekdays') }),
  z.strictObject({
    kind: z.literal('weekly'),
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .transform((d) => [...new Set(d)].sort((a, b) => a - b)),
  }),
  z.strictObject({
    kind: z.literal('every'),
    n: z.number().int().min(1),
    start: date,
  }),
]);

/** The item an item_props row points at: a collection name and an id. */
const linkedSchema = z.strictObject({ c: text, id: text });
/** @public */
export type Linked = z.infer<typeof linkedSchema>;

/** Overrides for a morning-made item: flat JSON scalars by field name. */
const overridesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
/** @public */
export type Overrides = z.infer<typeof overridesSchema>;

/** An item_props row (PLAN §5.10 `item_props(c, id, time, repeat, linked_c, linked_id, overrides, at, v)`); every field is present, null meaning "not set". */
export const itemPropsSchema = z.strictObject({
  c: text,
  id: text,
  /** 'HH:MM' Central wall time, or null. */
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  repeat: repeatSchema.nullable(),
  linked: linkedSchema.nullable(),
  overrides: overridesSchema.nullable(),
  at: text,
  v: z.number().int().min(1),
});
export type ItemProps = z.infer<typeof itemPropsSchema>;

/** The kinds an added plan item may have: general work for any goal, no subject built in. */
export type AddedKind = 'todo' | 'reading' | 'learn' | 'practice' | 'review' | 'notes';

/** What a repeating plan item looks like each day: a day's `added` entry minus `at` and `by`. */
export type PlanTemplate = {
  text: string;
  kind: AddedKind;
  minutes?: number;
  course?: string;
  tag?: string | null;
};

/** One entry of a day's `added` map (by is always Matt: a repeat is his own plan item). */
export type AddedEntry = PlanTemplate & { at: string; by: 'Matt' };

/** One day's occurrence ready to be written under `rep-<id>-<date>`. */
export type Occurrence = { date: string; key: string; entry: AddedEntry };
