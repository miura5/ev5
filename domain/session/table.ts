import { z } from "zod";
import {
  day,
  deletable,
  json,
  ms,
  prefixed,
  stamp,
  text,
} from "../table-row/index.ts";
import { EVENT_TYPES, STATUSES } from "./types.ts";

/** The `sessions` row (table design 2.8). Only the note kind is stored (per the table-design decision); the day is in the user's time zone. */
export const sessionTableSchema = z.strictObject({
  id: prefixed("ses_"),
  kind: z.literal("note"),
  note_id: z.string().min(1).nullable(),
  set_id: z.string().min(1).nullable(),
  collection_id: z.string().min(1).nullable(),
  day,
  status: z.enum(STATUSES),
  planned_min: z.number().int().min(0).nullable(),
  started_at: ms.nullable(),
  ended_at: ms.nullable(),
  topic: z.string().nullable(),
  clock: z.literal("writing").nullable(),
  minutes: z.number().int().min(0).nullable(),
  driver: z.strictObject({ view: text, at: ms }).nullable(),
  ...stamp,
  ...deletable,
});
export type SessionTableRow = z.infer<typeof sessionTableSchema>;

/** The append-only `session_events` row. E.V.'s comments are talk rows, not events. */
export const sessionEventRowSchema = z.strictObject({
  id: prefixed("sese_"),
  session_id: text,
  type: z.enum(EVENT_TYPES),
  body: json.nullable(),
  ...stamp,
});
export type SessionEventRow = z.infer<typeof sessionEventRowSchema>;

/** Validates a sessions row. */
export function parseSessionTableRow(raw: unknown): SessionTableRow {
  return sessionTableSchema.parse(raw);
}

/** Validates a session_events row. */
export function parseSessionEventRow(raw: unknown): SessionEventRow {
  return sessionEventRowSchema.parse(raw);
}
