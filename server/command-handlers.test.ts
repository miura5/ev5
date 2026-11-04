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
  ]) {
    const text = readFileSync(
      new URL(`../data/migrations/${f}.sql`, import.meta.url),
      "utf8",
    );
    for (const stmt of text.replace(/--.*$/gm, "").split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  }
  await DB.prepare(
    "INSERT INTO docs (c, id, data, at, v) VALUES ('sets', 's1', '{\"title\":\"Old\"}', 1, 1)",
  ).run();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  return (name: string, input: unknown) =>
    app.request(
      `/api/v1/commands/${name}`,
      {
        method: "POST",
        headers: { authorization: `Bearer app-t` },
        body: JSON.stringify({ input }),
      },
      env,
    );
}

test("every handler belongs to a registry command Matt calls directly", () => {
  for (const name of Object.keys(commandHandlers)) {
    const cmd = byName(name);
    assert.ok(cmd, name);
    // a chat turn answers once on the Worker (ask.send); ask.just_tell_me only logs, though the registry says 'job'
    assert.ok(
      ["instant", "chat"].includes(cmd.effect) ||
        ["ask.just_tell_me", "job.retry_shorter"].includes(name),
      name,
    );
    assert.equal(cmd.callers.matt, "direct");
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
