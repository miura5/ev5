import { z } from "zod";
import {
  day as date,
  deletable,
  prefixed,
  stamp,
  text,
  WRITERS,
} from "../table-row/index.ts";
import { EVENT_TYPES, WEAK_SPOT_KINDS } from "./types.ts";

/** The `weak_spots` row (table design 2.6): no init_* columns, no links array; a duplicate points at its twin. */
export const weakSpotTableSchema = z.strictObject({
  id: prefixed("ws_"),
  collection_id: z.string().min(1).nullable(),
  objective_id: z.string().min(1).nullable(),
  topic: text,
  kind: z.enum(WEAK_SPOT_KINDS),
  words: z.string().nullable(),
  source_line: text,
  duplicate_of: z.string().min(1).nullable(),
  proposed: z.union([z.literal(0), z.literal(1)]),
  created_by: z.enum(WRITERS),
  pre_read: z.union([z.literal(0), z.literal(1)]),
  reading_due: date.nullable(),
  ...stamp,
  ...deletable,
});
export type WeakSpotTableRow = z.infer<typeof weakSpotTableSchema>;

/** The append-only `weak_spot_events` row: two quick taps are two inserts. */
export const weakSpotEventRowSchema = z
  .strictObject({
    id: prefixed("wse_"),
    weak_spot_id: text,
    type: z.enum(EVENT_TYPES),
    by: z.enum(WRITERS),
    note: z.string().nullable(),
    objective_id: z.string().min(1).nullable(),
    until: date.nullable(),
    ...stamp,
  })
  .refine((e) => e.type !== "snooze" || e.until !== null, {
    message: "snooze needs until",
    path: ["until"],
  });
export type WeakSpotEventRow = z.infer<typeof weakSpotEventRowSchema>;

/** Validates a weak_spots row. */
export function parseWeakSpotTableRow(raw: unknown): WeakSpotTableRow {
  return weakSpotTableSchema.parse(raw);
}

/** Validates a weak_spot_events row. */
export function parseWeakSpotEventRow(raw: unknown): WeakSpotEventRow {
  return weakSpotEventRowSchema.parse(raw);
}
