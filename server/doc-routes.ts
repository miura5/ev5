// /api/v1/docs: read and write documents under the write protocol (CONTRACT §data.protocol), through data's gate
// (§data.gate). Auth is applied by index.ts. The collection and id travel in the query.
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
import { goalDocs } from "./goal-wire.ts";
import { noteDocById, noteDocs, saveNote } from "./note-wire.ts";
import { saveSession, sessionDocs } from "./session-wire.ts";
import { createWeakSpot, weakSpotDocs } from "./weak-wire.ts";

export interface DocRoutesEnv {
  DB: DocsD1;
}

type Ctx = {
  Bindings: DocRoutesEnv;
  Variables: AuthVars;
};
export const docRoutes = new Hono<Ctx>();
const SESSIONS = "sessions";
const WEAK_SPOTS = "weakspots";
const NOTES = "notes";

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
    // Goals are rows, not documents (§data.tables): a goal changed since then is sent as its exam document.
    const goals = (await goalDocs(c.env.DB, () => Date.now()))
      .filter((g) => g.at > n)
      .map((g) => shape({ c: "exams", ...g }));
    // Sessions are rows too: one changed since then (a new event bumps its row) is sent as its session document.
    const sessions = (await sessionDocs(c.env.DB, () => Date.now()))
      .filter((s) => s.at > n)
      .map((s) => shape({ c: SESSIONS, ...s }));
    // Weak spots are rows too: an old weakspots document is never sent; a spot changed since then (a new event bumps
    // its row) is sent as its weak spot document.
    const spots = (await weakSpotDocs(c.env.DB, () => Date.now()))
      .filter((s) => s.at > n)
      .map((s) => shape({ c: WEAK_SPOTS, ...s }));
    // Notes are rows too (§data.tables): the older documents are left behind in docs and never sent.
    const notes = (await noteDocs(c.env.DB, () => Date.now()))
      .filter((m) => m.at > n)
      .map((m) => shape({ c: NOTES, ...m }));
    return c.json({
      now: out.now,
      docs: [
        ...out.docs
          .filter((d) => d.c !== NOTES && d.c !== WEAK_SPOTS)
          .map(shape),
        ...goals,
        ...sessions,
        ...notes,
        ...spots,
      ],
    });
  }
  if (!collection) return c.json({ error: "collection is required" }, 400);
  // Weak spots live in their tables (§data.tables); the screens still read them as documents.
  if (collection === "weakspots") {
    const spots = (await weakSpotDocs(c.env.DB, () => Date.now())).map((s) =>
      shape({ c: collection, id: s.id, data: s.data, at: s.at, v: s.v }),
    );
    if (id === undefined) return c.json({ docs: spots });
    const one = spots.find((s) => s.id === id);
    return one ? c.json(one) : c.json({ error: "not found" }, 404);
  }
  // Sessions and their events are rows (§data.tables); the screens still read the session document.
  if (collection === "sessions") {
    const all = (await sessionDocs(c.env.DB, () => Date.now())).map((s) =>
      shape({ c: collection, ...s }),
    );
    if (id === undefined) return c.json({ docs: all });
    const one = all.find((s) => s.id === id);
    return one ? c.json(one) : c.json({ error: "not found" }, 404);
  }
  // Notes are rows (§data.tables); the editor still reads the note document.
  if (collection === NOTES) {
    if (id === undefined)
      return c.json({
        docs: (await noteDocs(c.env.DB, () => Date.now())).map((m) =>
          shape({ c: collection, ...m }),
        ),
      });
    const one = await noteDocById(c.env.DB, () => Date.now(), id);
    return one
      ? c.json(shape({ c: collection, ...one }))
      : c.json({ error: "not found" }, 404);
  }
  // Goals are rows (§data.tables): the exams list is the goals, each as its exam document.
  if (collection === "exams") {
    const goals = (await goalDocs(c.env.DB, () => Date.now())).map((g) =>
      shape({ c: collection, ...g }),
    );
    if (id === undefined) return c.json({ docs: goals });
    const goal = goals.find((g) => g.id === id);
    return goal ? c.json(goal) : c.json({ error: "not found" }, 404);
  }
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
  if (collection === "weakspots") {
    // A weak spot is a row, never a document (§data.tables).
    const made = await createWeakSpot(
      c.env.DB,
      () => Date.now(),
      id,
      text,
      iv === undefined ? null : Number(iv),
    );
    if (made.ok) return c.json({ at: made.at, version: made.version });
    return c.json({ error: made.error }, made.status);
  }
  if (collection === "sessions") {
    // A session is a row and its events are appended rows, never a document (§data.append-only).
    const done = await saveSession(
      c.env.DB,
      () => Date.now(),
      id,
      text,
      iv === undefined ? null : Number(iv),
    );
    if (done.ok) return c.json({ at: done.at, version: done.version });
    return c.json({ error: done.error }, done.status);
  }
  if (collection === NOTES) {
    // A note is a row, never a document (§data.tables); a stale save is a 409 and the screen keeps both (§data.notes).
    const done = await saveNote(
      c.env.DB,
      () => Date.now(),
      id,
      text,
      iv === undefined ? null : Number(iv),
    );
    if (done.ok) return c.json({ at: done.at, version: done.version });
    return c.json({ error: done.error }, done.status);
  }
  const res = await repo(c.env.DB).save(
    collection,
    id,
    text,
    iv === undefined ? null : Number(iv),
  );
  if (res.ok)
    return c.json({
      at: res.at,
      version: res.version,
      ...(res.warnings && { warnings: res.warnings }),
    });
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
  if (
    Array.isArray(writes) &&
    writes.some((w) => {
      const k = (w as { collection?: unknown })?.collection;
      return k === "weakspots" || k === SESSIONS || k === NOTES;
    })
  )
    return c.json(
      { error: "weak spots, sessions and notes are written one at a time" },
      400,
    );
  const res = await repo(c.env.DB).batch(writes);
  if (res.ok)
    return c.json({
      at: res.at,
      results: res.results,
      ...(res.warnings && { warnings: res.warnings }),
    });
  const { status, ...rest } = res;
  return c.json(rest, status);
});

docRoutes.delete("/docs", (c) => c.json({ error: NO_DELETE }, 403));
