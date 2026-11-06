import { z } from 'zod';

// A collection row (PLAN §5.10 `collections(id, title, parent_id, pos, at, v)`); parent_id is parentId here.
export const collectionSchema = z
  .strictObject({
    id: z.string().min(1),
    title: z.string().min(1),
    /** Another collection's id, or null at the top level. Nesting is one level (§data.membership). */
    parentId: z.string().min(1).nullable(),
    pos: z.number().finite(),
    at: z.string().min(1),
    v: z.number().int().min(1),
  })
  .refine((c) => c.parentId !== c.id, { message: 'a collection cannot be its own parent', path: ['parentId'] });
export type Collection = z.infer<typeof collectionSchema>;

/** A memberships row: the item (collection name and id) and the collection it sits in. */
export const membershipSchema = z.strictObject({
  itemC: z.string().min(1),
  itemId: z.string().min(1),
  collectionId: z.string().min(1),
  at: z.string().min(1),
  v: z.number().int().min(1),
});
export type Membership = z.infer<typeof membershipSchema>;

/** What a move writes: a membership row, or just dropping the row. */
export type MoveWrite = { kind: 'row'; collectionId: string } | { kind: 'ungroup'; removeRow: true };
