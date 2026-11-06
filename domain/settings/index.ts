// domain/settings: the `settings` row (table design 2.14), `key` primary key, replacing claude_settings; gains `v`.
import { z } from "zod";
import { ms, text } from "../table-row/index.ts";

export const settingRowSchema = z.strictObject({
  key: text,
  value: z.number().int(),
  at: ms,
  v: z.number().int().min(1),
});
export type SettingRow = z.infer<typeof settingRowSchema>;

export const parseSettingRow = (raw: unknown): SettingRow =>
  settingRowSchema.parse(raw);
