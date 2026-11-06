// The v5 `pins` row (table design 2.14): the kept table gets a prefixed id, `v` and soft delete; target_c becomes target_kind.
import { z } from "zod";
import { deletable, prefixed, stamp, text } from "../table-row/index.ts";

export const pinTableSchema = z.strictObject({
  id: prefixed("pin_"),
  target_kind: text,
  target_id: text,
  pos: z.number().finite(),
  ...stamp,
  ...deletable,
});
export type PinTableRow = z.infer<typeof pinTableSchema>;

export const parsePinTableRow = (raw: unknown): PinTableRow =>
  pinTableSchema.parse(raw);
