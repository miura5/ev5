// domain/file: the `files` row (table design 2.12), note pictures only; the bytes live in R2 under `r2_key`.
import { z } from "zod";
import { deletable, prefixed, stamp, text } from "../table-row/index.ts";

export const fileRowSchema = z.strictObject({
  id: prefixed("file_"),
  kind: z.literal("note_image"),
  type: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/, "type must be a MIME type"),
  size: z.number().int().min(0),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, "sha256 must be 64 hex digits"),
  r2_key: text,
  owner_kind: text,
  owner_id: text,
  ...stamp,
  ...deletable,
});
export type FileRow = z.infer<typeof fileRowSchema>;

export const parseFileRow = (raw: unknown): FileRow => fileRowSchema.parse(raw);
