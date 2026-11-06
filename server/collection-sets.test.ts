// Sets and dates are rows, so a collection page, a pin, a move and a rename must reach them through the gate
// (§data.tables, §data.gate, §data.links).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

async function setup() {
  const DB = sqliteD1();
  const dir = new URL("../data/migrations/", import.meta.url);
  for (const f of [
    "0000_baseline",
    "0001_deletions",
    "0003_collections_pins_own",
    "0004_ceiling_usage",
    "0006_tables",
    "0009_collections_pins_expand",
  ]) {
    const text = readFileSync(new URL(`${f}.sql`, dir), "utf8");
    for (const stmt of text.replace(/--.*$/gm, "").split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  }
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const get = (path: string) =>
    app.request(
      `/api/v1${path}`,
      { headers: { authorization: "Bearer app-t" } },
      env,
    );
  const call = async (name: string, input: unknown) => {
    const r = await app.request(
      `/api/v1/commands/${name}`,
      {
        method: "POST",
        headers: { authorization: "Bearer app-t" },
        body: JSON.stringify({ input }),
      },
      env,
    );
    return {
      status: r.status,
      body: (await r.json()) as { result: Record<string, any> },
    };
  };
  return { DB, get, call };
}

test("a new set shows once on its collection page, titled", async () => {
  const { get, call } = await setup();
  const col = (await call("collection.create", { title: "Unit 1" })).body.result
    .collection.id;
  const made = await call("set.create", { title: "Heart", collection: col });
  assert.equal(made.status, 200);
  const id = made.body.result.set.id;
  const m = (await (await get(`/memberships?collection_id=${col}`)).json()) as {
    memberships: { collection: string; id: string }[];
  };
  assert.deepEqual(
    m.memberships.map((x) => [x.collection, x.id]),
    [["sets", id]],
  );
  const d = (await (await get("/docs?collection=sets")).json()) as {
    docs: { id: string; data: { title: string } }[];
  };
  assert.equal(d.docs.find((x) => x.id === id)?.data.title, "Heart");
});

test("an own set copied by the migration is not listed twice", async () => {
  const { DB, get, call } = await setup();
  const col = (await call("collection.create", { title: "Unit 1" })).body.result
    .collection.id;
  const id = (await call("set.create", { title: "Old", collection: col })).body
    .result.set.id;
  await DB.prepare(
    "INSERT INTO memberships (item_c, item_id, collection_id, at, v) VALUES ('own_sets', ?, ?, 1, 1)",
  )
    .bind(id.slice(4), col)
    .run();
  await DB.prepare(
    "INSERT INTO memberships (item_c, item_id, collection_id, at, v) VALUES ('sets', ?, ?, 1, 1)",
  )
    .bind(id, col)
    .run();
  const m = (await (await get(`/memberships?collection_id=${col}`)).json()) as {
    memberships: unknown[];
  };
  assert.equal(m.memberships.length, 1);
});

test("a set and a date can be pinned, moved, renamed and unpinned", async () => {
  const { DB, get, call } = await setup();
  const col = (await call("collection.create", { title: "Unit 2" })).body.result
    .collection.id;
  const set = (await call("set.create", { title: "Lungs" })).body.result.set.id;
  const goal = (
    await call("date.create", { title: "Exam 1", date: "2026-12-01" })
  ).body.result.id;
  for (const id of [set, goal]) {
    assert.equal((await call("item.pin", { id })).status, 200, id);
    assert.equal(
      (await call("item.rename", { id, title: "Renamed" })).status,
      200,
      id,
    );
    assert.equal(
      (await call("item.move", { id, collection: col })).status,
      200,
      id,
    );
  }
  const one = async (sql: string, id: string) =>
    (await DB.prepare(sql).bind(id).first<{ x: string }>())?.x;
  assert.equal(
    await one("SELECT title AS x FROM sets WHERE id = ?", set),
    "Renamed",
  );
  assert.equal(
    await one("SELECT title AS x FROM goals WHERE id = ?", goal),
    "Renamed",
  );
  assert.equal(
    await one("SELECT collection_id AS x FROM sets WHERE id = ?", set),
    col,
  );
  const m = (await (await get(`/memberships?collection_id=${col}`)).json()) as {
    memberships: { id: string }[];
  };
  assert.deepEqual(m.memberships.map((x) => x.id).sort(), [goal, set].sort());
  for (const id of [set, goal]) {
    const un = await call("item.unpin", { id });
    assert.equal(un.body.result.removed, true, id);
  }
});
