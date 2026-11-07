// The read-only lists the collection routes serve (§data.gate, §data.tables): collections, memberships, pins and
// Recently deleted, as the wire's column names. The SQL lives here, not in server/. `collections` and `memberships`
// read as empty on a database that does not have them yet.
import type { D1Like } from "../d1.ts";

/** The most rows one of these lists returns. */
const LIMIT = 500;

export interface CollectionRow {
  id: string;
  title: string;
  parent_id: string | null;
  pos: number;
  at: number;
  v: number;
}
export interface MembershipRow {
  item_c: string;
  item_id: string;
  collection_id: string | null;
  at: number;
  v: number;
}
export interface PinRow {
  target_c: string;
  target_id: string;
  pos: number;
  at: number;
}
export interface DeletionRow {
  c: string;
  id: string;
  at: number;
  t: string | null;
}

/** The kinds Recently deleted lists: name, table, the SQL for the title. */
const DELETED: [string, string, string][] = [
  ["collections", "collections", "title"],
  ["notes", "notes", "title"],
  ["sets", "sets", "title"],
  ["goals", "goals", "title"],
  ["sessions", "sessions", "topic"],
  ["set_items", "set_items", "json_extract(body, '$.stem')"],
];

export function collectionReadsRepo(db: D1Like) {
  /** The rows of a read, or none when the table does not exist yet. Any other failure is raised. */
  async function rows<T>(
    sql: string,
    args: (string | number)[] = [],
  ): Promise<T[]> {
    try {
      return (
        await db
          .prepare(sql)
          .bind(...args)
          .all<T>()
      ).results;
    } catch (e) {
      if (/no such table/i.test(String((e as Error)?.message))) return [];
      throw e;
    }
  }
  return {
    collectionReads: {
      /** Every live collection, by pos then id. */
      collections: () =>
        rows<CollectionRow>(
          `SELECT id, title, parent_id, pos, at, v FROM collections WHERE deleted_at IS NULL ORDER BY pos, id LIMIT ${LIMIT}`,
        ),
      /** Live sets with the collection each keeps on its own row. */
      setPlacements: () =>
        rows<MembershipRow>(
          `SELECT 'sets' AS item_c, id AS item_id, collection_id, at, v FROM sets WHERE deleted_at IS NULL LIMIT ${LIMIT}`,
        ),
      /** Every note (deleted ones too, so a deleted note's old membership row stays hidden) with its own collection. */
      notePlacements: () =>
        rows<MembershipRow & { deleted_at: number | null }>(
          `SELECT 'notes' AS item_c, id AS item_id, collection_id, at, v, deleted_at FROM notes LIMIT ${LIMIT}`,
        ),
      /** Membership rows, newest first, not in a deleted collection; one collection when `collectionId` is given. */
      memberships: (collectionId?: string) =>
        rows<MembershipRow>(
          `SELECT item_c, item_id, collection_id, at, v FROM memberships WHERE NOT EXISTS (SELECT 1 FROM collections d WHERE d.id = memberships.collection_id AND d.deleted_at IS NOT NULL)${collectionId === undefined ? "" : " AND collection_id = ?"} ORDER BY at DESC, item_c, item_id LIMIT ${LIMIT}`,
          collectionId === undefined ? [] : [collectionId],
        ),
      /** Ids of the deleted collections. */
      deletedCollectionIds: async (): Promise<string[]> =>
        (
          await rows<{ id: string }>(
            "SELECT id FROM collections WHERE deleted_at IS NOT NULL",
          )
        ).map((r) => r.id),
      /** Pinned items, by pos then newest first. */
      pins: () =>
        rows<PinRow>(
          `SELECT target_c, target_id, pos, at FROM pins ORDER BY pos, at DESC, target_c, target_id LIMIT ${LIMIT}`,
        ),
      /** Rows with `deleted_at` set (§delete.soft), newest first; one kind when `kind` is given. */
      deletions: async (kind?: string): Promise<DeletionRow[]> => {
        const out: DeletionRow[] = [];
        for (const [name, table, title] of DELETED) {
          if (kind !== undefined && kind !== name) continue;
          out.push(
            ...(await rows<DeletionRow>(
              `SELECT '${name}' AS c, id, deleted_at AS at, ${title} AS t FROM ${table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ${LIMIT}`,
            )),
          );
        }
        return out;
      },
    },
  };
}
