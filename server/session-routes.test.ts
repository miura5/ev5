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
  ])
    for (const stmt of readFileSync(
      new URL(`../data/migrations/${f}.sql`, import.meta.url),
      "utf8",
    )
      .replace(/--.*$/gm, "")
      .split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const call = (method: string, url: string, body?: unknown) =>
    app.request(
      "/api/v1/docs" + url,
      {
        method,
        headers: { authorization: "Bearer app-t" },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
    );
  return { DB, call };
}

const T0 = "2026-10-18T15:00:00.000Z";
const doc = (events: Record<string, object>, extra: object = {}) => ({
  schema: 2,
  writer: "page",
  at: T0,
  source: "E.V. Home",
  date: "2026-10-18",
  status: "active",
  kind: "note",
  startedAt: T0,
  planned: 25,
  noteId: "n-1",
  events,
  ...extra,
});
const start = { "page-20261018-150000-aaa": { type: "start", at: T0 } };

test("PUT /docs?collection=sessions writes a row and appends only new events; GET shows the document", async () => {
  const { DB, call } = await setup();
  const q = "?collection=sessions&id=ss-1";
  const made = await call("PUT", q, doc(start));
  assert.equal(made.status, 200);
  assert.equal(((await made.json()) as { version: number }).version, 1);
  const more = {
    ...start,
    "page-20261018-150700-bbb": {
      type: "break",
      at: "2026-10-18T15:07:00.000Z",
    },
  };
  assert.equal((await call("PUT", `${q}&if_version=1`, doc(more))).status, 200);
  // a stale version is a 409 and appends nothing
  assert.equal((await call("PUT", `${q}&if_version=1`, doc(more))).status, 409);
  const n = async (t: string) =>
    (await DB.prepare(`SELECT count(*) AS n FROM ${t}`).first<{ n: number }>())
      ?.n;
  assert.equal(await n("sessions"), 1);
  assert.equal(await n("session_events"), 2);
  assert.equal(await n("docs"), 0);
  const got = (await (await call("GET", q)).json()) as {
    v: number;
    data: { events: Record<string, { type: string; at: string }> };
  };
  assert.equal(got.v, 2);
  assert.deepEqual(
    Object.entries(got.data.events).map(([k, e]) => [k, e.type, e.at]),
    [
      ["page-20261018-150000-aaa", "start", T0],
      ["page-20261018-150700-bbb", "break", "2026-10-18T15:07:00.000Z"],
    ],
  );
  // a stored event cannot be taken out
  const gone = await call("PUT", `${q}&if_version=2`, doc(start));
  assert.equal(gone.status, 400);
  assert.equal(await n("session_events"), 2);
  assert.equal(
    (
      (await (await call("GET", "?collection=sessions")).json()) as {
        docs: unknown[];
      }
    ).docs.length,
    1,
  );
});

test("a skill session and a batch write of sessions are refused", async () => {
  const { call } = await setup();
  assert.equal(
    (
      await call(
        "PUT",
        "?collection=sessions&id=ss-2",
        doc(start, { kind: "skill" }),
      )
    ).status,
    400,
  );
  const batch = await call("POST", "/batch", {
    writes: [
      { op: "set", collection: "sessions", doc_id: "ss-3", data: doc(start) },
    ],
  });
  assert.equal(batch.status, 400);
});
