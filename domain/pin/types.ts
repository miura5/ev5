import { z } from 'zod';

// A pins row (PLAN §5.10 `pins(target_c, target_id, pos, at)`); the sidebar lists them in `pos` order.
export const pinSchema = z.strictObject({
  /** The target's collection name (legacy `c`, or a v5 table such as "collections"). */
  targetC: z.string().min(1),
  targetId: z.string().min(1),
  pos: z.number().finite(),
  at: z.string().min(1),
});
export type Pin = z.infer<typeof pinSchema>;
