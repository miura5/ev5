import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

async function setup() {
  const DB = sqliteD1();
  await DB.prepare(
    "CREATE TABLE docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  for (const f of [
    "0001_deletions",
    "0003_collections_pins_own",
    "0006_tables",
    "0009_collections_pins_expand",
  ])
    for (const stmt of readFileSync(
      new URL(`../data/migrations/${f}.sql`, import.meta.url),
      "utf8",
    )
      .replace(/--.*$/gm, "")
      .split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const call = (method: string, url: string, body?: unknown, base = "docs") =>
    app.request(
      `/api/v1/${base}${url}`,
      {
        method,
        headers: { authorization: "Bearer app-t" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
    );
  const command = (name: string, input: unknown) =>
    app.request(
      `/api/v1/commands/${name}`,
      {
        method: "POST",
        headers: { authorization: "Bearer app-t" },
        body: JSON.stringify({ input }),
      },
      env,
    );
  return { DB, call, command };
}

const T0 = "2026-10-18T15:00:00.000Z";
const note = (extra: object = {}) => ({
  schema: 1,
  writer: "page",
  at: T0,
  source: "E.V. Home",
  createdAt: "2026-10-17T09:00:00.000Z",
  title: "Fluids",
  course: "Biology 101",
  blocks: [{ type: "p", runs: [{ text: "Sodium is 135 to 145." }] }],
  ...extra,
});
const q = "?collection=notes&id=n-a";

test("PUT /docs?collection=notes writes a row; GET shows the same document; a stale save is a 409", async () => {
  const { DB, call } = await setup();
  const made = await call("PUT", q, note());
  assert.equal(made.status, 200);
  assert.equal(((await made.json()) as { version: number }).version, 1);
  const moved = note({
    title: "Fluids 2",
    blocks: [{ type: "p", runs: [{ text: "Potassium 3.5 to 5." }] }],
  });
  assert.equal((await call("PUT", `${q}&if_version=1`, moved)).status, 200);
  assert.equal((await call("PUT", `${q}&if_version=1`, moved)).status, 409);
  const row = await DB.prepare("SELECT title, text, v FROM notes").first<{
    title: string;
    text: string;
    v: number;
  }>();
  assert.deepEqual(
    { ...row },
    {
      title: "Fluids 2",
      text: "Potassium 3.5 to 5.",
      v: 2,
    },
  );
  assert.equal(
    (await DB.prepare("SELECT count(*) AS n FROM docs").first<{ n: number }>())
      ?.n,
    0,
  );
  const got = (await (await call("GET", q)).json()) as {
    v: number;
    data: { title: string; course?: string; blocks: unknown[] };
  };
  assert.equal(got.v, 2);
  assert.equal(got.data.title, "Fluids 2");
  assert.equal(got.data.course, undefined); // the row keeps the block format only (§data.notes)
  assert.equal(
    (
      (await (await call("GET", "?collection=notes")).json()) as {
        docs: unknown[];
      }
    ).docs.length,
    1,
  );
  assert.equal((await call("GET", "?collection=notes&id=n-zz")).status, 404);
  // the changed-since feed carries it
  const since = (await (await call("GET", "?since=0")).json()) as {
    docs: { collection: string; id: string }[];
  };
  assert.deepEqual(
    since.docs.filter((d) => d.collection === "notes").map((d) => d.id),
    ["n-a"],
  );
});

test("a note is refused when it is not a note, when createdAt changes, or in a batch", async () => {
  const { call } = await setup();
  assert.equal((await call("PUT", q, { title: "x" })).status, 400);
  assert.equal(
    (await call("PUT", "?collection=notes&id=bad id", note())).status,
    400,
  );
  assert.equal((await call("PUT", q, note())).status, 200);
  assert.equal(
    (
      await call(
        "PUT",
        `${q}&if_version=1`,
        note({ createdAt: "2026-10-18T09:00:00.000Z" }),
      )
    ).status,
    400,
  );
  const batch = await call("POST", "/batch", {
    writes: [{ op: "set", collection: "notes", doc_id: "n-b", data: note() }],
  });
  assert.equal(batch.status, 400);
});

test("a stale save keeps both: the second note points at the first and is titled (earlier)", async () => {
  const { DB, call } = await setup();
  await call("PUT", q, note());
  const earlier = note({
    title: "Fluids (earlier)",
    earlierOf: "n-a",
    createdAt: T0,
  });
  assert.equal(
    (
      await call(
        "PUT",
        "?collection=notes&id=n-20261018-150100-abcdefgh",
        earlier,
      )
    ).status,
    200,
  );
  const r = await DB.prepare(
    "SELECT earlier_of FROM notes WHERE id = 'note_n-20261018-150100-abcdefgh'",
  ).first<{ earlier_of: string }>();
  assert.equal(r?.earlier_of, "note_n-a");
});

test("pin, rename, delete and restore work on a note that only has a row", async () => {
  const { DB, call, command } = await setup();
  await call("PUT", q, note());
  assert.equal((await command("item.pin", { id: "n-a" })).status, 200);
  assert.equal(
    (await command("item.rename", { id: "n-a", title: "Renamed" })).status,
    200,
  );
  assert.equal(
    ((await (await call("GET", q)).json()) as { data: { title: string } }).data
      .title,
    "Renamed",
  );
  assert.equal((await command("item.delete", { id: "n-a" })).status, 200);
  assert.equal((await call("GET", q)).status, 404);
  const gone = (await (
    await call("GET", "?collection=notes", undefined, "deletions")
  ).json()) as {
    deletions: { id: string; title: string }[];
  };
  assert.deepEqual(
    gone.deletions.map((d) => [d.id, d.title]),
    [["n-a", "Renamed"]],
  );
  assert.equal((await command("item.restore", { id: "n-a" })).status, 200);
  assert.equal((await call("GET", q)).status, 200);
  assert.equal(
    (
      await DB.prepare("SELECT count(*) AS n FROM deletions").first<{
        n: number;
      }>()
    )?.n,
    0,
  );
});
