// domain/link: the one many-to-many table. A link points at a goal or an objective (table design 2.4): a note, set or
// file is for a goal; an objective or a weak spot is on a goal; a note, set or file covers an objective. Material waits (per the table-design decision).
import { z } from "zod";
import {
  deletable,
  prefixed,
  stamp,
  text,
  WRITERS,
} from "../table-row/index.ts";

const SOURCES = ["note", "set", "file"] as const;
/** The (from_kind, to_kind) pairs a link may join. */
export const LINK_PAIRS: readonly (readonly [string, string])[] = [
  ...SOURCES.map((k) => [k, "goal"] as const),
  ["objective", "goal"],
  ["weak_spot", "goal"],
  ...SOURCES.map((k) => [k, "objective"] as const),
];

export const linkRowSchema = z
  .strictObject({
    id: prefixed("link_"),
    from_kind: text,
    from_id: text,
    to_kind: z.enum(["goal", "objective"]),
    to_id: text,
    by: z.enum(WRITERS),
    note: z.string().nullable(),
    ...stamp,
    ...deletable,
  })
  .refine(
    (l) => LINK_PAIRS.some(([f, t]) => f === l.from_kind && t === l.to_kind),
    {
      message: "this pair of kinds cannot be linked",
      path: ["from_kind"],
    },
  );
export type LinkRow = z.infer<typeof linkRowSchema>;

/** Validates a links row; throws on a pair the table does not allow. */
export function parseLinkRow(raw: unknown): LinkRow {
  return linkRowSchema.parse(raw);
}
