// domain/talk: the `talk` row, append-only (table design 2.11). One row per line said, in an Ask E.V. chat or a session
// check-in. A new chat_id starts a new chat. No update, no delete column.
import { z } from "zod";
import { json, prefixed, stamp, text } from "../table-row/index.ts";

export const talkRowSchema = z
  .strictObject({
    id: prefixed("talk_"),
    chat_id: text,
    scope: z.enum(["ask", "session"]),
    session_id: z.string().min(1).nullable(),
    context_kind: z.string().min(1).nullable(),
    context_id: z.string().min(1).nullable(),
    role: z.enum(["user", "ev"]),
    text,
    cites: json.nullable(),
    job_id: z.string().min(1).nullable(),
    ...stamp,
  })
  .refine((t) => (t.context_kind === null) === (t.context_id === null), {
    message: "context is a kind and an id",
  })
  .refine((t) => t.scope !== "session" || t.session_id !== null, {
    message: "a session line names its session",
  });
export type TalkRow = z.infer<typeof talkRowSchema>;

/** Validates a talk row. */
export function parseTalkRow(raw: unknown): TalkRow {
  return talkRowSchema.parse(raw);
}
