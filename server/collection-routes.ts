// /api/v1 read routes for the tables that are not docs (PLAN §data): Collections, their memberships, pins and Recently
// deleted. Auth is applied by index.ts. Read only: there is no write or delete here (§delete.soft).
//   GET /collections                          every collection, by pos then id
//   GET /memberships[?collection_id=x]        item-to-collection rows, newest first
//   GET /pins                                 pinned items, by pos then newest first
//   GET /deletions[?collection=c]             rows with deleted_at set, newest first (nothing is removed)
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
  // Recently deleted is every row whose `deleted_at` is set (§delete.soft); a note is listed by its id minus `note_`.
  const kinds: [string, string, string][] = [
    ["collections", "collections", "title"],
    ["notes", "notes", "title"],
    ["sets", "sets", "title"],
    ["goals", "goals", "title"],
    ["sessions", "sessions", "topic"],
    ["set_items", "set_items", "json_extract(body, '$.stem')"],
  ];
  const out: { c: string; id: string; at: number; t: string | null }[] = [];
  for (const [name, table, title] of kinds) {
    if (coll !== undefined && coll !== name) continue;
    const id = name === "notes" ? "substr(id, 6)" : "id";
    out.push(
      ...(await rows<{ c: string; id: string; at: number; t: string | null }>(
        c.env.DB,
        `SELECT '${name}' AS c, ${id} AS id, deleted_at AS at, ${title} AS t FROM ${table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ${LIMIT}`,
        [],
      )),
    );
  }
  out.sort(
    (a, b) => b.at - a.at || a.c.localeCompare(b.c) || a.id.localeCompare(b.id),
  );
  return c.json({
    deletions: out.slice(0, LIMIT).map((r) => ({
      collection: r.c,
      id: r.id,
      at: r.at,
      title: typeof r.t === "string" && r.t.trim() ? r.t.trim() : null,
    })),
  });
});
