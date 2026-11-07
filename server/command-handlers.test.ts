import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { byName } from "../commands/index.ts";
import { commandHandlers } from "./command-handlers.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

async function setup() {
  const DB = sqliteD1();
  for (const f of [
    "0000_baseline",
    "0001_deletions",
    "0003_collections_pins_own",
    "0004_ceiling_usage",
    "0006_tables",
    "0009_collections_pins_expand", // the old pins repository fills the new columns
  ]) {
    const text = readFileSync(
      new URL(`../data/migrations/${f}.sql`, import.meta.url),
      "utf8",
    );
    for (const stmt of text.replace(/--.*$/gm, "").split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  }
  await DB.prepare(
    'INSERT INTO docs (c, id, data, at, v) VALUES (\'sets\', \'s1\', \'{"schema":3,"writer":"page","at":"2026-11-03T00:00:00Z","source":"t","kind":"review","items":[{"id":"i1","stem":"q"}],"title":"Old"}\', 1, 1)',
  ).run();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const call = (name: string, input: unknown) =>
    app.request(
      `/api/v1/commands/${name}`,
      {
        method: "POST",
        headers: { authorization: `Bearer app-t` },
        body: JSON.stringify({ input }),
      },
      env,
    );
  return Object.assign(call, {
    db: DB,
    get: (path: string) =>
      app.request(
        `/api/v1${path}`,
        { headers: { authorization: "Bearer app-t" } },
        env,
      ),
  });
}

test("every handler belongs to a registry command Matt calls directly", () => {
  for (const name of Object.keys(commandHandlers)) {
    const cmd = byName(name);
    assert.ok(cmd, name);
    // a chat turn answers once on the Worker (ask.send); ask.just_tell_me only logs, though the registry says 'job'
    assert.ok(
      ["instant", "chat"].includes(cmd.effect) ||
        [
          "ask.just_tell_me",
          "job.retry_shorter",
          "date.plan_with_ev",
          "plan.ask_changes",
        ].includes(name),
      name,
    );
    // job_sweep is the schedule's own command (the 15-minute cron), not Matt's
    assert.equal(
      cmd.callers[name === "job_sweep" ? "schedule" : "matt"],
      "direct",
    );
  }
});

test("pin, unpin, rename, delete and restore work on a document", async () => {
  const call = await setup();
  assert.equal((await call("item.pin", { id: "s1" })).status, 200);
  assert.equal((await call("item.pin", { id: "nope" })).status, 404);
  const un = (await (await call("item.unpin", { id: "s1" })).json()) as {
    result: { removed: boolean };
  };
  assert.equal(un.result.removed, true);
  assert.equal(
    (await call("item.rename", { id: "s1", title: "New" })).status,
    200,
  );
  assert.equal((await call("item.delete", { id: "s1" })).status, 200);
  assert.equal((await call("item.restore", { id: "s1" })).status, 200);
  assert.equal((await call("item.restore", { id: "s1" })).status, 404);
});

test("deleting an unknown collection id is a 404", async () => {
  const call = await setup();
  assert.equal((await call("item.delete", { id: "col_nope" })).status, 404);
});

test("a collection is created and an item moves into it", async () => {
  const call = await setup();
  const made = (await (
    await call("collection.create", { title: "BIO" })
  ).json()) as { result: { collection: { id: string } } };
  assert.equal(
    (
      await call("item.move", {
        id: "s1",
        collection: made.result.collection.id,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("item.move", { id: "s1", collection: "missing" })).status,
    404,
  );
});

test("a screen-side command is acknowledged and the registry lists are served", async () => {
  const call = await setup();
  assert.equal((await call("theme.toggle", {})).status, 200);
  const env = { DB: sqliteD1(), TOKEN_APP: "app-t" } as unknown as Env;
  const get = (p: string) =>
    app.request(
      `/api/v1/commands/${p}`,
      { headers: { authorization: "Bearer app-t" } },
      env,
    );
  const pal = (await (await get("palette")).json()) as {
    entries: { name: string }[];
  };
  assert.ok(pal.entries.some((e) => e.name === "theme.toggle"));
  assert.ok(
    ((await (await get("tools")).json()) as { tools: unknown[] }).tools.length >
      0,
  );
});

test("deleting a collection writes one row for it; its items show ungrouped until it is restored", async () => {
  const call = await setup();
  const made = (await (
    await call("collection.create", { title: "BIO" })
  ).json()) as { result: { collection: { id: string } } };
  const cid = made.result.collection.id;
  await call("item.move", { id: "s1", collection: cid });
  const ids = async (path: string, key: string) =>
    ((await (await call.get(path)).json()) as Record<string, { id: string }[]>)[
      key
    ]!.map((r) => r.id);

  assert.equal((await call("item.delete", { id: cid })).status, 200);
  const rows = await call.db
    .prepare("SELECT c, id FROM deletions")
    .all<{ c: string; id: string }>();
  assert.deepEqual(
    rows.results.map((r) => ({ c: r.c, id: r.id })),
    [{ c: "collections", id: cid }],
  );
  assert.deepEqual(await ids("/collections", "collections"), []);
  assert.deepEqual(
    await ids(`/memberships?collection_id=${cid}`, "memberships"),
    [],
  );
  const listed = (await (await call.get("/deletions")).json()) as {
    deletions: { collection: string; title: string | null }[];
  };
  assert.deepEqual(
    listed.deletions.map((d) => [d.collection, d.title]),
    [["collections", "BIO"]],
  );

  assert.equal((await call("item.restore", { id: cid })).status, 200);
  assert.deepEqual(await ids("/collections", "collections"), [cid]);
  assert.deepEqual(
    await ids(`/memberships?collection_id=${cid}`, "memberships"),
    ["s1"],
  );
});

test("item.rename renames a collection in its own table", async () => {
  const call = await setup();
  const made = (await (
    await call("collection.create", { title: "Untitled collection" })
  ).json()) as { result: { collection: { id: string } } };
  const id = made.result.collection.id;
  assert.equal(
    (await call("item.rename", { id, title: "Economics 101" })).status,
    200,
  );
  assert.equal(
    (await call("item.rename", { id, title: "Course B" })).status,
    200,
  );
});

test("item.restore brings a removed set item back, by its id or an old <set>/<item> key", async () => {
  const call = await setup();
  await call.db
    .prepare(
      "INSERT INTO set_items (id, set_id, pos, type, body, at, v, deleted_at) VALUES ('item_a','set_1',1,'single','{\"stem\":\"q\"}',1,2,5),('item_b','set_1',2,'single','{\"stem\":\"r\"}',1,2,5)",
    )
    .run();
  await call.db
    .prepare(
      "INSERT INTO deletions VALUES ('set_items','item_a',5),('own_set_items','set_1/b',5),('own_set_items','set_1/item_b',5)",
    )
    .run();
  assert.equal((await call("item.restore", { id: "item_a" })).status, 200);
  const a = await call.db
    .prepare("SELECT deleted_at, v FROM set_items WHERE id = 'item_a'")
    .all<{ deleted_at: number | null; v: number }>();
  assert.equal(a.results[0]?.deleted_at, null);
  assert.equal(a.results[0]?.v, 3);
  assert.equal((await call("item.restore", { id: "item_a" })).status, 404);
  assert.equal((await call("item.restore", { id: "set_1/b" })).status, 200);
  const left = await call.db.prepare("SELECT id FROM deletions").all();
  assert.equal(left.results.length, 0);
});
