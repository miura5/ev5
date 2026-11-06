import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

async function setup(withTables: boolean) {
  const DB = sqliteD1();
  await DB.prepare(
    "CREATE TABLE deletions (c TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  await DB.prepare("INSERT INTO deletions VALUES ('notes','a',10)").run();
  await DB.prepare("INSERT INTO deletions VALUES ('sets','b',30)").run();
  await DB.prepare(
    "INSERT INTO deletions VALUES ('own_set_items','set_1/item_1',20)",
  ).run();
  await DB.prepare(
    "CREATE TABLE docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  await DB.prepare(
    `INSERT INTO docs VALUES ('notes','a','{"title":"Cardiac drugs"}',1,1)`,
  ).run();
  await DB.prepare(
    `INSERT INTO set_items (id, set_id, pos, type, body, at) VALUES ('item_1','set_1',1,'single','{"stem":"Which lab is highest priority?"}',1)`,
  ).run();
  if (withTables) {
    await DB.prepare(
      "CREATE TABLE collections (id TEXT PRIMARY KEY, title TEXT NOT NULL, parent_id TEXT, pos INTEGER NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL)",
    ).run();
    await DB.prepare(
      "CREATE TABLE memberships (item_c TEXT NOT NULL, item_id TEXT NOT NULL, collection_id TEXT NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (item_c, item_id))",
    ).run();
    await DB.prepare(
      "INSERT INTO collections VALUES ('c2','Spanish',NULL,2,5,1),('c1','NUR 112',NULL,1,5,1),('c3','Unit 1','c1',1,6,1)",
    ).run();
    await DB.prepare(
      "CREATE TABLE pins (target_c TEXT NOT NULL, target_id TEXT NOT NULL, pos INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (target_c, target_id))",
    ).run();
    await DB.prepare(
      "INSERT INTO pins VALUES ('sets','s1',1,5),('notes','n1',0,9),('notes','n2',1,8)",
    ).run();
    await DB.prepare(
      "INSERT INTO memberships VALUES ('notes','n1','c1',7,1),('sets','s1','c2',9,1)",
    ).run();
  }
  const env = {
    DB,
    TOKEN_APP: "app-t",
    TOKEN_SCHEDULE: "sch-t",
  } as unknown as Env;
  return (method: string, url: string, token: string | null = "app-t") =>
    app.request(
      "/api/v1" + url,
      { method, headers: token ? { authorization: `Bearer ${token}` } : {} },
      env,
    );
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
      ["c1", null],
      ["c3", "c1"],
      ["c2", null],
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
    ["s1", "n1"],
  );
  const one = (await (
    await call("GET", "/memberships?collection_id=c1")
  ).json()) as {
    memberships: { id: string; collection: string }[];
  };
  assert.deepEqual(
    one.memberships.map((m) => [m.collection, m.id]),
    [["notes", "n1"]],
  );
});

test("deletions read newest first and filter by collection", async () => {
  const call = await setup(true);
  const all = (await (await call("GET", "/deletions")).json()) as {
    deletions: { collection: string; id: string; at: number }[];
  };
  assert.deepEqual(
    all.deletions.map((d) => d.id),
    ["b", "set_1/item_1", "a"],
  );
  const one = (await (
    await call("GET", "/deletions?collection=notes")
  ).json()) as {
    deletions: { id: string }[];
  };
  assert.deepEqual(
    one.deletions.map((d) => d.id),
    ["a"],
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
  assert.equal(t.notes, "Cardiac drugs");
  assert.equal(t.own_set_items, "Which lab is highest priority?");
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
      ["notes", "n1", 0],
      ["notes", "n2", 1],
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
