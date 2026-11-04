// /api/v1 read routes for the tables that are not docs (PLAN §data): Collections, their memberships and Recently
// deleted. Auth is applied by index.ts. Read only: there is no write or delete here (§delete.soft).
//   GET /collections                          every collection, by pos then id
//   GET /memberships[?collection_id=x]        item-to-collection rows, newest first
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
interface DeletionRow {
  c: string;
  id: string;
  at: number;
}

collectionRoutes.get("/collections", async (c) => {
  const out = await rows<CollectionRow>(
    c.env.DB,
    `SELECT id, title, parent_id, pos, at, v FROM collections ORDER BY pos, id LIMIT ${LIMIT}`,
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
    `SELECT item_c, item_id, collection_id, at, v FROM memberships${id === undefined ? "" : " WHERE collection_id = ?"} ORDER BY at DESC, item_c, item_id LIMIT ${LIMIT}`,
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

collectionRoutes.get("/deletions", async (c) => {
  const coll = c.req.query("collection");
  const out = await rows<DeletionRow>(
    c.env.DB,
    `SELECT c, id, at FROM deletions${coll === undefined ? "" : " WHERE c = ?"} ORDER BY at DESC, c, id LIMIT ${LIMIT}`,
    coll === undefined ? [] : [coll],
  );
  return c.json({
    deletions: out.map((r) => ({ collection: r.c, id: r.id, at: r.at })),
  });
});
