import type { parseCourseTable } from '../course/index.ts';
import type { Collection, ItemCourse, Membership, MoveWrite, VirtualCollection } from './types.ts';

type CourseTable = ReturnType<typeof parseCourseTable>;

const PREFIX = 'course:';

/** The id of the virtual collection for an ev4 course. */
export const courseCollectionId = (course: string): string => `${PREFIX}${course}`;

/** The course key behind a virtual collection id, or null for a real collection id. */
export const virtualCourse = (id: string): string | null => (id.startsWith(PREFIX) ? id.slice(PREFIX.length) : null);

/** Every course in the table as a read-only virtual collection, in table order. */
export function virtualCollections(table: CourseTable): VirtualCollection[] {
  return table.map((c) => ({ id: courseCollectionId(c.name), title: c.name, readOnly: true }));
}

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
 * The collection an item shows in: its membership row, else its ev4 course (as `course:<key>`), else null.
 * A course change newer than the row wins over it. A row whose collection is gone (not in `live`) leaves the item
 * ungrouped; the row stays, so restoring the collection regroups the item (§delete.collection).
 */
export function effectiveCollection(
  item: ItemCourse,
  row: Membership | undefined,
  live: ReadonlySet<string>,
): string | null {
  const byCourse = item.course ? courseCollectionId(item.course) : null;
  if (!row) return byCourse;
  if (byCourse && item.courseAt && item.courseAt > row.at) return byCourse;
  return live.has(row.collectionId) ? row.collectionId : null;
}

/** What moving an item into `target` writes. A course target is virtual: it writes ev4's course and drops the row. */
export function moveWrite(target: string | null, live: ReadonlySet<string>): MoveWrite {
  if (target === null) return { kind: 'ungroup', removeRow: true };
  const course = virtualCourse(target);
  if (course !== null) return { kind: 'course', course, removeRow: true };
  if (!live.has(target)) throw new Error(`collection: ${target} does not exist`);
  return { kind: 'row', collectionId: target };
}
