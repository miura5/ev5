// /api/v1/docs: read and write documents over the ev4 write protocol (CONTRACT §data.protocol). Auth is applied by
// index.ts. Collections can nest, so the collection and id travel in the query, as in ev4's run API.
//   GET    /docs?collection=c            one collection, ordered by id
//   GET    /docs?collection=c&id=x       one document, or 404
//   GET    /docs?since=<ms>              every document changed after since, and the next since
//   PUT    /docs?collection=c&id=x[&if_version=n]   one whole document; a create names no version; 409 when stale
//   POST   /docs/batch                   {writes:[{op,collection,doc_id,data,if_version}]}, all or nothing
//   DELETE /docs                         refused with 403 (§delete.who): the Worker has no delete path
import { Hono } from "hono";
import { docsRepo, MAX_BODY, NO_DELETE } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import type { AuthVars } from "./auth.ts";

export interface DocRoutesEnv {
  DB: DocsD1;
}

type Ctx = {
  Bindings: DocRoutesEnv;
  Variables: AuthVars;
};
export const docRoutes = new Hono<Ctx>();

const repo = (db: DocsD1) => docsRepo(db, { clock: () => Date.now() });
const shape = (d: {
  c: string;
  id: string;
  data: unknown;
  at: number;
  v: number;
}) => ({
  collection: d.c,
  id: d.id,
  v: d.v,
  at: d.at,
  data: d.data,
});

/** The whole body as text, or null when it is over the 1 MB ceiling. */
async function bodyText(req: Request): Promise<string | null> {
  const text = await req.text();
  return new TextEncoder().encode(text).length > MAX_BODY ? null : text;
}

docRoutes.get("/docs", async (c) => {
  const { collection, id, since } = c.req.query();
  const r = repo(c.env.DB);
  if (since !== undefined) {
    const n = Number(since);
    if (!Number.isFinite(n) || n < 0)
      return c.json({ error: "since: a time in ms" }, 400);
    const out = await r.changedSince(n);
    return c.json({ now: out.now, docs: out.docs.map(shape) });
  }
  if (!collection) return c.json({ error: "collection is required" }, 400);
  if (id === undefined)
    return c.json({ docs: (await r.list(collection)).map(shape) });
  const doc = await r.get(collection, id);
  return doc ? c.json(shape(doc)) : c.json({ error: "not found" }, 404);
});

docRoutes.put("/docs", async (c) => {
  const { collection, id, if_version: iv } = c.req.query();
  if (!collection || !id)
    return c.json({ error: "collection and id are required" }, 400);
  const text = await bodyText(c.req.raw);
  if (text === null) return c.json({ error: "body is over 1 MB" }, 413);
  const res = await repo(c.env.DB).save(
    collection,
    id,
    text,
    iv === undefined ? null : Number(iv),
  );
  if (res.ok) return c.json({ at: res.at, version: res.version });
  const { status, ...rest } = res;
  return c.json(rest, status);
});

docRoutes.post("/docs/batch", async (c) => {
  const text = await bodyText(c.req.raw);
  if (text === null) return c.json({ error: "body is over 1 MB" }, 413);
  let writes: unknown;
  try {
    writes = (JSON.parse(text) as { writes?: unknown }).writes;
  } catch {
    return c.json({ error: "body is not JSON" }, 400);
  }
  const res = await repo(c.env.DB).batch(writes);
  if (res.ok) return c.json({ at: res.at, results: res.results });
  const { status, ...rest } = res;
  return c.json(rest, status);
});

docRoutes.delete("/docs", (c) => c.json({ error: NO_DELETE }, 403));
