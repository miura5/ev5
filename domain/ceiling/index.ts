// domain/ceiling: the stored rows behind the cost ceilings: `ceiling_use`, `ceiling_holds` and `ceiling_usage` (§model.ceilings).
// Money is whole micro-dollars.
import { z } from 'zod';

export const CEILING_WINDOWS = ['hour', 'day', 'month', 'job'] as const;
const windowSchema = z.enum(CEILING_WINDOWS);

export const ceilingUseSchema = z.strictObject({
  w: windowSchema,
  k: z.string().min(1),
  used: z.number().int(),
});
export type CeilingUse = z.infer<typeof ceilingUseSchema>;

export const ceilingLimitSchema = z.strictObject({
  window: windowSchema,
  key: z.string().min(1),
  limit: z.number().int().min(0),
});

export const ceilingHoldSchema = z.strictObject({
  id: z.string().min(1),
  amount: z.number().int().min(0),
  limits: z.array(ceilingLimitSchema),
  open: z.boolean(),
});
export type CeilingHold = z.infer<typeof ceilingHoldSchema>;

export const ceilingUsageSchema = z.strictObject({
  key: z.string().min(1),
  holdId: z.string().min(1),
});
export type CeilingUsage = z.infer<typeof ceilingUsageSchema>;

export const parseCeilingUse = (raw: unknown): CeilingUse => ceilingUseSchema.parse(raw);
export const parseCeilingHold = (raw: unknown): CeilingHold => ceilingHoldSchema.parse(raw);
export const parseCeilingUsage = (raw: unknown): CeilingUsage => ceilingUsageSchema.parse(raw);
