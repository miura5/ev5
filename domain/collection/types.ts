// A collection row (PLAN §5.10 `collections(id, title, parent_id, pos, at, v)`); parent_id is parentId here.
export type Collection = {
  id: string;
  title: string;
  /** Another collection's id, or null at the top level. Nesting is one level (§data.membership). */
  parentId: string | null;
  pos: number;
  at: string;
  v: number;
};

/** A memberships row: the item (collection name and id) and the collection it sits in. */
export type Membership = {
  itemC: string;
  itemId: string;
  collectionId: string;
  at: string;
  v: number;
};

/** An ev4 course shown as a read-only collection `course:<key>`; it is never stored. */
export type VirtualCollection = { id: string; title: string; readOnly: true };

/** What the collection rules read of an item: its ev4 course and when that course last changed. */
export type ItemCourse = { course?: string | null; courseAt?: string | null };

/** What a move writes: a membership row, the ev4 course field (and drop the row), or just dropping the row. */
export type MoveWrite =
  | { kind: 'row'; collectionId: string }
  | { kind: 'course'; course: string; removeRow: true }
  | { kind: 'ungroup'; removeRow: true };
