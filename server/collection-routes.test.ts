import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

async function setup(withTables: boolean) {
  const DB = sqliteD1();
  await DB.prepare(
    "INSERT INTO sets (id, kind, created_by, at, v, deleted_at) VALUES ('set_b','practice','matt',1,1,30)",
  ).run();
  await DB.prepare(
    `INSERT INTO notes (id, collection_id, title, body, text, at, v, deleted_at) VALUES ('note_a', NULL, 'Key terms', '{}', '', 1, 1, 10)`,
  ).run();
  await DB.prepare(
    `INSERT INTO set_items (id, set_id, pos, type, body, at, deleted_at) VALUES ('item_1','set_1',1,'single','{"stem":"Which lab is highest priority?"}',1,20)`,
  ).run();
  if (withTables) {
    await DB.prepare(
      "CREATE TABLE collections (id TEXT PRIMARY KEY, title TEXT NOT NULL, parent_id TEXT, pos INTEGER NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL, deleted_at INTEGER)",
    ).run();
    await DB.prepare(
      "CREATE TABLE memberships (item_c TEXT NOT NULL, item_id TEXT NOT NULL, collection_id TEXT NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (item_c, item_id))",
    ).run();
    await DB.prepare(
      "INSERT INTO collections VALUES ('col_c2','Spanish',NULL,2,5,1,NULL),('col_c1','Course A',NULL,1,5,1,NULL),('col_c3','Unit 1','col_c1',1,6,1,NULL)",
    ).run();
    await DB.prepare(
      "CREATE TABLE pins (target_c TEXT NOT NULL, target_id TEXT NOT NULL, pos INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (target_c, target_id))",
    ).run();
    await DB.prepare(
      "INSERT INTO pins VALUES ('sets','s1',1,5),('notes','note_n1',0,9),('notes','note_n2',1,8)",
    ).run();
    await DB.prepare(
      "INSERT INTO memberships VALUES ('notes','note_n1','col_c1',7,1),('sets','s1','col_c2',9,1)",
    ).run();
  }
  const env = {
    DB,
    TOKEN_APP: "app-t",
    TOKEN_SCHEDULE: "sch-t",
  } as unknown as Env;
  const call = (method: string, url: string, token: string | null = "app-t") =>
    app.request(
      "/api/v1" + url,
      { method, headers: token ? { authorization: `Bearer ${token}` } : {} },
      env,
    );
  return Object.assign(call, { db: DB });
}

test("collections read by position, with parent ids", async () => {
  const call = await setup(true);
  const r = await call("GET", "/collections");
  assert.equal(r.status, 200);
  const j = (await r.json()) as {
    collections: { id: string; parentId: string | null }[];
  };
  assert.deepEqual(
    j.collections.map((c) => [c.id, c.parentId]),
    [
      ["col_c1", null],
      ["col_c3", "col_c1"],
      ["col_c2", null],
    ],
  );
});

test("a note's collection is read from its own row, not from a stale membership", async () => {
  const call = await setup(true);
  const DB = call.db;
  await DB.prepare(
    "INSERT INTO notes (id, collection_id, title, body, text, at, v, deleted_at) VALUES ('note_n1','col_c2','t','{}','',20,2,NULL),('note_n3','col_c1','t','{}','',15,1,NULL),('note_n4','col_c1','t','{}','',16,1,10)",
  ).run();
  const one = (await (
    await call("GET", "/memberships?collection_id=col_c1")
  ).json()) as { memberships: { collection: string; id: string }[] };
  assert.deepEqual(
    one.memberships.map((m) => [m.collection, m.id]),
    [["notes", "note_n3"]],
  );
  const to = (await (
    await call("GET", "/memberships?collection_id=col_c2")
  ).json()) as { memberships: { collection: string; id: string }[] };
  assert.deepEqual(
    to.memberships.map((m) => [m.collection, m.id]),
    [
      ["notes", "note_n1"],
      ["sets", "s1"],
    ],
  );
});

test("memberships read newest first and filter by collection", async () => {
  const call = await setup(true);
  const all = (await (await call("GET", "/memberships")).json()) as {
    memberships: { id: string; collection: string; collectionId: string }[];
  };
  assert.deepEqual(
    all.memberships.map((m) => m.id),
    ["s1", "note_n1"],
  );
  const one = (await (
    await call("GET", "/memberships?collection_id=col_c1")
  ).json()) as {
    memberships: { id: string; collection: string }[];
  };
  assert.deepEqual(
    one.memberships.map((m) => [m.collection, m.id]),
    [["notes", "note_n1"]],
  );
});

test("deletions read newest first and filter by collection", async () => {
  const call = await setup(true);
  const all = (await (await call("GET", "/deletions")).json()) as {
    deletions: { collection: string; id: string; at: number }[];
  };
  assert.deepEqual(
    all.deletions.map((d) => d.id),
    ["set_b", "item_1", "note_a"],
  );
  const one = (await (
    await call("GET", "/deletions?collection=notes")
  ).json()) as {
    deletions: { id: string }[];
  };
  assert.deepEqual(
    one.deletions.map((d) => d.id),
    ["note_a"],
  );
});

test("deletions carry the kept item's title, for a note and for a set item", async () => {
  const call = await setup(true);
  const all = (await (await call("GET", "/deletions")).json()) as {
    deletions: { collection: string; title: string | null }[];
  };
  const t = Object.fromEntries(
    all.deletions.map((d) => [d.collection, d.title]),
  );
  assert.equal(t.notes, "Key terms");
  assert.equal(t.set_items, "Which lab is highest priority?");
  assert.equal(t.sets, null);
});

test("pins read by position, newest first within a position", async () => {
  const call = await setup(true);
  const r = await call("GET", "/pins");
  assert.equal(r.status, 200);
  const j = (await r.json()) as {
    pins: { collection: string; id: string; pos: number }[];
  };
  assert.deepEqual(
    j.pins.map((p) => [p.collection, p.id, p.pos]),
    [
      ["notes", "note_n1", 0],
      ["notes", "note_n2", 1],
      ["sets", "s1", 1],
    ],
  );
  assert.equal((await call("GET", "/pins", null)).status, 401);
});

test("tables not yet migrated read as empty", async () => {
  const call = await setup(false);
  assert.deepEqual(await (await call("GET", "/collections")).json(), {
    collections: [],
  });
  assert.deepEqual(await (await call("GET", "/memberships")).json(), {
    memberships: [],
  });
  assert.deepEqual(await (await call("GET", "/pins")).json(), { pins: [] });
  assert.equal(
    (
      (await (await call("GET", "/deletions")).json()) as {
        deletions: unknown[];
      }
    ).deletions.length,
    3,
  );
});

test("a token is required, and there is no write or delete", async () => {
  const call = await setup(true);
  assert.equal((await call("GET", "/deletions", null)).status, 401);
  for (const m of ["PUT", "POST", "DELETE"]) {
    const r = await call(m, "/deletions");
    assert.ok(r.status === 404 || r.status === 405, `${m} -> ${r.status}`);
  }
});

test("a set item filter reads only removed set items", async () => {
  const call = await setup(true);
  const j = (await (
    await call("GET", "/deletions?collection=set_items")
  ).json()) as {
    deletions: { collection: string; id: string; title: string | null }[];
  };
  assert.deepEqual(
    j.deletions.map((d) => [d.collection, d.id, d.title]),
    [["set_items", "item_1", "Which lab is highest priority?"]],
  );
});
