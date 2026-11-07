// /api/v1 read routes for the tables that are not docs (PLAN §data): Collections, their memberships, pins and Recently
// deleted. Auth is applied by index.ts. Read only: there is no write or delete here (§delete.soft).
//   GET /collections                          every collection, by pos then id
//   GET /memberships[?collection_id=x]        item-to-collection rows, newest first
//   GET /pins                                 pinned items, by pos then newest first
//   GET /deletions[?collection=c]             soft-delete rows, newest first (the docs stay where they are)
// `collections` and `memberships` arrive with the cutover migration (C13); until a database has them they read as empty.
import { Hono } from "hono";
import type { DocsD1 } from "../data/index.ts";
import { itemKey } from "../domain/index.ts";
import type { AuthVars } from "./auth.ts";

export interface CollectionRoutesEnv {
  DB: DocsD1;
}

export const collectionRoutes = new Hono<{
  Bindings: CollectionRoutesEnv;
  Variables: AuthVars;
}>();

const LIMIT = 500;

/** The rows of a read, or none when the table does not exist yet. Any other failure is raised. */
async function rows<T>(
  db: DocsD1,
  sql: string,
  args: (string | number)[],
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

interface CollectionRow {
  id: string;
  title: string;
  parent_id: string | null;
  pos: number;
  at: number;
  v: number;
}
interface MembershipRow {
  item_c: string;
  item_id: string;
  collection_id: string;
  at: number;
  v: number;
}
interface PinRow {
  target_c: string;
  target_id: string;
  pos: number;
  at: number;
}
interface DeletionRow {
  c: string;
  id: string;
  at: number;
}

collectionRoutes.get("/collections", async (c) => {
  const out = await rows<CollectionRow>(
    c.env.DB,
    `SELECT id, title, parent_id, pos, at, v FROM collections WHERE deleted_at IS NULL ORDER BY pos, id LIMIT ${LIMIT}`,
    [],
  );
  return c.json({
    collections: out.map((r) => ({
      id: r.id,
      title: r.title,
      parentId: r.parent_id,
      pos: r.pos,
      at: r.at,
      v: r.v,
    })),
  });
});

collectionRoutes.get("/memberships", async (c) => {
  const id = c.req.query("collection_id");
  // A set on the `sets` table keeps its collection on its own row (the one place a move, a create and a source scope
  // agree on), so a membership row for it is not read: that is the `own_sets` copy migration 0008 left, or a stale
  // `sets` one. A membership for any other item (a document, a note, a date) is read as it is.
  const sets = await rows<MembershipRow>(
    c.env.DB,
    `SELECT 'sets' AS item_c, id AS item_id, collection_id, at, v FROM sets WHERE deleted_at IS NULL LIMIT ${LIMIT}`,
    [],
  );
  const own = new Set(sets.map((r) => r.item_id));
  // A note keeps its collection on its own row too (`notes.collection_id`, the id minus its `note_` prefix is the
  // document id the screens use), so a `notes` membership row is read only for a note that has no row yet.
  const noteRows = await rows<MembershipRow & { deleted_at: number | null }>(
    c.env.DB,
    `SELECT 'notes' AS item_c, substr(id, 6) AS item_id, collection_id, at, v, deleted_at FROM notes LIMIT ${LIMIT}`,
    [],
  );
  const noted = new Set(noteRows.map((r) => r.item_id));
  const placed = await rows<MembershipRow>(
    c.env.DB,
    `SELECT item_c, item_id, collection_id, at, v FROM memberships WHERE NOT EXISTS (SELECT 1 FROM collections d WHERE d.id = memberships.collection_id AND d.deleted_at IS NOT NULL)${id === undefined ? "" : " AND collection_id = ?"} ORDER BY at DESC, item_c, item_id LIMIT ${LIMIT}`,
    id === undefined ? [] : [id],
  );
  const gone = new Set(
    (
      await rows<{ id: string }>(
        c.env.DB,
        "SELECT id FROM collections WHERE deleted_at IS NOT NULL",
        [],
      )
    ).map((r) => r.id),
  );
  const out = [
    ...placed.filter(
      (r) =>
        r.item_c !== "own_sets" &&
        !(r.item_c === "sets" && own.has(r.item_id)) &&
        !(r.item_c === "notes" && noted.has(r.item_id)),
    ),
    ...noteRows.filter(
      (r) =>
        r.deleted_at === null &&
        r.collection_id != null &&
        !gone.has(r.collection_id) &&
        (id === undefined || r.collection_id === id),
    ),
    ...sets.filter(
      (r) =>
        r.collection_id != null &&
        !gone.has(r.collection_id) &&
        (id === undefined || r.collection_id === id),
    ),
  ]
    .sort(
      (x, y) =>
        y.at - x.at ||
        x.item_c.localeCompare(y.item_c) ||
        x.item_id.localeCompare(y.item_id),
    )
    .slice(0, LIMIT);
  return c.json({
    memberships: out.map((r) => ({
      collection: r.item_c,
      id: r.item_id,
      collectionId: r.collection_id,
      at: r.at,
      v: r.v,
    })),
  });
});

collectionRoutes.get("/pins", async (c) => {
  const out = await rows<PinRow>(
    c.env.DB,
    `SELECT target_c, target_id, pos, at FROM pins ORDER BY pos, at DESC, target_c, target_id LIMIT ${LIMIT}`,
    [],
  );
  return c.json({
    pins: out.map((r) => ({
      collection: r.target_c,
      id: r.target_id,
      pos: r.pos,
      at: r.at,
    })),
  });
});

collectionRoutes.get("/deletions", async (c) => {
  const coll = c.req.query("collection");
  // A set item is listed as `set_items` by its item id. Rows written before that (`own_set_items`, keyed
  // `<set>/<item>`) are read as the same thing, the newest delete time winning, so the screen has one shape.
  const legacy = coll === undefined || coll === "set_items";
  const raw = await rows<DeletionRow>(
    c.env.DB,
    `SELECT c, id, at FROM deletions${coll === undefined ? "" : legacy ? " WHERE c IN ('set_items', 'own_set_items')" : " WHERE c = ?"} ORDER BY at DESC, c, id LIMIT ${LIMIT}`,
    coll === undefined || legacy ? [] : [coll],
  );
  const SET_ITEMS = "set_items";
  const seen = new Map<string, DeletionRow>();
  for (const r of raw) {
    const row =
      r.c === "own_set_items"
        ? {
            ...r,
            c: SET_ITEMS,
            id: itemKey(r.id.slice(r.id.indexOf("/") + 1)),
          }
        : r;
    const key = `${row.c}/${row.id}`;
    if (!seen.has(key) || (seen.get(key) as DeletionRow).at < row.at)
      seen.set(key, row);
  }
  // A set-item row with no set_items row to bring back (an old key whose item is gone) is hidden: it would list
  // untitled and could not be restored.
  const itemIds = new Set(
    (await rows<{ id: string }>(c.env.DB, "SELECT id FROM set_items", [])).map(
      (r) => r.id,
    ),
  );
  const out = [...seen.values()]
    .filter((r) => r.c !== SET_ITEMS || itemIds.has(r.id))
    .sort(
      (a, b) =>
        b.at - a.at || a.c.localeCompare(b.c) || a.id.localeCompare(b.id),
    );
  // Titles come from the kept row (the delete is soft, §delete.soft); each lookup is its own read so a database
  // without that table still lists its deletions.
  const titles = new Map<string, string>();
  const items = await rows<{ k: string; t: string | null }>(
    c.env.DB,
    "SELECT 'set_items/' || i.id AS k, json_extract(i.body, '$.stem') AS t FROM deletions d JOIN set_items i ON (d.c = 'set_items' AND d.id = i.id) OR (d.c = 'own_set_items' AND d.id = i.set_id || '/' || i.id)",
    [],
  );
  const colls = await rows<{ k: string; t: string | null }>(
    c.env.DB,
    "SELECT 'collections/' || d.id AS k, x.title AS t FROM deletions d JOIN collections x ON d.c = 'collections' AND x.id = d.id",
    [],
  );
  const notes = await rows<{ k: string; t: string | null }>(
    c.env.DB,
    "SELECT 'notes/' || d.id AS k, x.title AS t FROM deletions d JOIN notes x ON d.c = 'notes' AND x.id = 'note_' || d.id",
    [],
  );
  const setsAndGoals = await rows<{ k: string; t: string | null }>(
    c.env.DB,
    "SELECT d.c || '/' || d.id AS k, x.title AS t FROM deletions d JOIN sets x ON d.c = 'sets' AND x.id = d.id UNION ALL SELECT d.c || '/' || d.id AS k, x.title AS t FROM deletions d JOIN goals x ON d.c = 'goals' AND x.id = d.id UNION ALL SELECT 'sessions/' || d.id AS k, x.topic AS t FROM deletions d JOIN sessions x ON d.c = 'sessions' AND x.id = d.id",
    [],
  );
  for (const r of [...items, ...colls, ...notes, ...setsAndGoals]) {
    if (typeof r.t === "string" && r.t.trim()) titles.set(r.k, r.t.trim());
  }
  return c.json({
    deletions: out.map((r) => ({
      collection: r.c,
      id: r.id,
      at: r.at,
      title: titles.get(`${r.c}/${r.id}`) ?? null,
    })),
  });
});
