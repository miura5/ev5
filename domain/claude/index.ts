// domain/claude: the rows of E.V.'s own bookkeeping tables carried from ev4: `claude_usage`, `claude_reads`, `claude_settings`
// and `claude_plan_asks` (§data.tables). Times are epoch milliseconds from the Worker clock.
import { z } from 'zod';

const count = z.number().int().min(0);
const at = z.number().int().min(0);

export const claudeUsageSchema = z.strictObject({
  hour: z.number().int(),
  day: z.string().min(1),
  tokens: count,
  calls: count,
});
export type ClaudeUsage = z.infer<typeof claudeUsageSchema>;

export const claudeReadSchema = z.strictObject({ note: z.string().min(1), h: z.string().min(1), at });
export type ClaudeRead = z.infer<typeof claudeReadSchema>;

export const claudeSettingSchema = z.strictObject({ key: z.string().min(1), value: z.number().int(), at });
export type ClaudeSetting = z.infer<typeof claudeSettingSchema>;

export const claudePlanAskSchema = z.strictObject({ job: z.string().min(1), n: count, at });
export type ClaudePlanAsk = z.infer<typeof claudePlanAskSchema>;

/** @public Wired by the follow-up that moves the bookkeeping writers onto the gate. */
export const parseClaudeUsage = (raw: unknown): ClaudeUsage => claudeUsageSchema.parse(raw);
/** @public Wired by the follow-up that moves the bookkeeping writers onto the gate. */
export const parseClaudeRead = (raw: unknown): ClaudeRead => claudeReadSchema.parse(raw);
export const parseClaudeSetting = (raw: unknown): ClaudeSetting => claudeSettingSchema.parse(raw);
/** @public Wired by the follow-up that moves the bookkeeping writers onto the gate. */
export const parseClaudePlanAsk = (raw: unknown): ClaudePlanAsk => claudePlanAskSchema.parse(raw);
