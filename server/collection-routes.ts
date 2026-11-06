// /api/v1 read routes for the tables that are not docs (PLAN §data): Collections, their memberships, pins and Recently
// deleted. Auth is applied by index.ts. Read only: there is no write or delete here (§delete.soft).
//   GET /collections                          every collection, by pos then id
//   GET /memberships[?collection_id=x]        item-to-collection rows, newest first
//   GET /pins                                 pinned items, by pos then newest first
//   GET /deletions[?collection=c]             soft-delete rows, newest first (the docs stay where they are)
// `collections` and `memberships` arrive with the cutover migration (C13); until a database has them they read as empty.
import { Hono } from "hono";
import type { DocsD1 } from "../data/index.ts";
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
  const out = await rows<MembershipRow>(
    c.env.DB,
    `SELECT item_c, item_id, collection_id, at, v FROM memberships WHERE NOT EXISTS (SELECT 1 FROM collections d WHERE d.id = memberships.collection_id AND d.deleted_at IS NOT NULL)${id === undefined ? "" : " AND collection_id = ?"} ORDER BY at DESC, item_c, item_id LIMIT ${LIMIT}`,
    id === undefined ? [] : [id],
  );
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
  const out = await rows<DeletionRow>(
    c.env.DB,
    `SELECT c, id, at FROM deletions${coll === undefined ? "" : " WHERE c = ?"} ORDER BY at DESC, c, id LIMIT ${LIMIT}`,
    coll === undefined ? [] : [coll],
  );
  // Titles come from the kept document (the delete is soft, §delete.soft); each lookup is its own read so a database
  // without that table still lists its deletions.
  const titles = new Map<string, string>();
  const named = await rows<{ k: string; t: string | null }>(
    c.env.DB,
    "SELECT d.c || '/' || d.id AS k, COALESCE(json_extract(x.data, '$.title'), json_extract(x.data, '$.name')) AS t FROM deletions d JOIN docs x ON x.c = d.c AND x.id = d.id",
    [],
  );
  const items = await rows<{ k: string; t: string | null }>(
    c.env.DB,
    "SELECT d.c || '/' || d.id AS k, json_extract(i.body, '$.stem') AS t FROM deletions d JOIN set_items i ON d.c = 'own_set_items' AND d.id = i.set_id || '/' || i.id",
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
  for (const r of [...named, ...items, ...colls, ...notes]) {
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
