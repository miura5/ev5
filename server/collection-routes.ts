// /api/v1 read routes for the tables that are not docs (PLAN §data): Collections, their memberships, pins and Recently
// deleted. Auth is applied by index.ts. Read only: there is no write or delete here (§delete.soft).
//   GET /collections                          every collection, by pos then id
//   GET /memberships[?collection_id=x]        item-to-collection rows, newest first
//   GET /pins                                 pinned items, by pos then newest first
//   GET /deletions[?collection=c]             rows with deleted_at set, newest first (nothing is removed)
// `collections` and `memberships` arrive with the cutover migration (C13); until a database has them they read as empty.
import { Hono } from "hono";
import { tablesRepo } from "../data/index.ts";
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
const reads = (db: DocsD1) =>
  tablesRepo(db, { clock: () => Date.now() }).collectionReads;

collectionRoutes.get("/collections", async (c) => {
  const out = await reads(c.env.DB).collections();
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
  const r = reads(c.env.DB);
  const sets = await r.setPlacements();
  const own = new Set(sets.map((r) => r.item_id));
  // A note keeps its collection on its own row too (`notes.collection_id`), so a `notes` membership row is read only for a note that has no row yet.
  const noteRows = await r.notePlacements();
  const noted = new Set(noteRows.map((r) => r.item_id));
  const placed = await r.memberships(id);
  const gone = new Set(await r.deletedCollectionIds());
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
  const out = await reads(c.env.DB).pins();
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
  // Recently deleted is every row whose `deleted_at` is set (§delete.soft).
  const out = await reads(c.env.DB).deletions(coll);
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
