import type { Collection, Membership, MoveWrite } from './types.ts';

/** Problems with the stored collections: a missing parent or a grandparent (one level only). Empty when sound. */
export function nestingProblems(rows: readonly Collection[]): string[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: string[] = [];
  for (const r of rows) {
    if (r.parentId === null) continue;
    const parent = byId.get(r.parentId);
    if (!parent) out.push(`${r.id}: parent ${r.parentId} does not exist`);
    else if (parent.parentId !== null) out.push(`${r.id}: has a grandparent (${parent.parentId})`);
  }
  return out;
}

/** Whether a collection may be created under parentId: the parent is a real top-level collection (null is top level). */
export function canNest(rows: readonly Collection[], parentId: string | null): boolean {
  if (parentId === null) return true;
  const parent = rows.find((r) => r.id === parentId);
  return !!parent && parent.parentId === null;
}

/**
 * The collection an item shows in: its membership row, else null. A row whose collection is gone (not in `live`)
 * leaves the item ungrouped; the row stays, so restoring the collection regroups the item (§delete.collection).
 */
export function effectiveCollection(row: Membership | undefined, live: ReadonlySet<string>): string | null {
  if (!row) return null;
  return live.has(row.collectionId) ? row.collectionId : null;
}

/** What moving an item into `target` writes: a membership row for a live collection, or dropping the row (null). */
export function moveWrite(target: string | null, live: ReadonlySet<string>): MoveWrite {
  if (target === null) return { kind: 'ungroup', removeRow: true };
  if (!live.has(target)) throw new Error(`collection: ${target} does not exist`);
  return { kind: 'row', collectionId: target };
}
