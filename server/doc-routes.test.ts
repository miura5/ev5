import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

async function setup() {
  const DB = sqliteD1();
  await DB.prepare(
    "CREATE TABLE docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  await DB.prepare(
    "CREATE TABLE deletions (c TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  const env = {
    DB,
    TOKEN_APP: "app-t",
    TOKEN_SCHEDULE: "sch-t",
  } as unknown as Env;
  return (method: string, url: string, body?: unknown, token = "app-t") =>
    app.request(
      "/api/v1/docs" + url,
      {
        method,
        headers: { authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
    );
}
type Call = Awaited<ReturnType<typeof setup>>;

const put = (call: Call, id: string, data: unknown, v?: number) =>
  call(
    "PUT",
    `?collection=scratch&id=${id}${v ? `&if_version=${v}` : ""}`,
    data,
  );

test("create, get, list and a conditional put", async () => {
  const call = await setup();
  const r1 = await put(call, "a", { b: 1, a: 2 });
  assert.equal(r1.status, 200);
  assert.equal(((await r1.json()) as { version: number }).version, 1);
  const got = (await (
    await call("GET", "?collection=scratch&id=a")
  ).json()) as { v: number; data: unknown };
  assert.equal(got.v, 1);
  assert.deepEqual(got.data, { a: 2, b: 1 });
  assert.equal(
    ((await (await put(call, "a", { a: 3 }, 1)).json()) as { version: number })
      .version,
    2,
  );
  await put(call, "b", { x: 1 });
  const list = (await (await call("GET", "?collection=scratch")).json()) as {
    docs: { id: string; v: number }[];
  };
  assert.deepEqual(
    list.docs.map((d) => [d.id, d.v]),
    [
      ["a", 2],
      ["b", 1],
    ],
  );
});

test("a stale or missing version is 409 and writes nothing", async () => {
  const call = await setup();
  await put(call, "a", { n: 1 });
  const stale = await put(call, "a", { n: 2 }, 5);
  assert.equal(stale.status, 409);
  assert.equal(
    ((await stale.json()) as { current_version: number }).current_version,
    1,
  );
  assert.equal((await put(call, "a", { n: 2 })).status, 409);
  const got = (await (
    await call("GET", "?collection=scratch&id=a")
  ).json()) as { data: { n: number } };
  assert.equal(got.data.n, 1);
});

test("missing document is 404, bad input is 400", async () => {
  const call = await setup();
  assert.equal((await call("GET", "?collection=scratch&id=nope")).status, 404);
  assert.equal((await call("GET", "")).status, 400);
  assert.equal((await call("PUT", "?collection=scratch", {})).status, 400);
  assert.equal((await call("GET", "?since=x")).status, 400);
});

test("changes since, and an all-or-nothing batch", async () => {
  const call = await setup();
  await put(call, "a", { n: 1 });
  const since = (await (await call("GET", "?since=0")).json()) as {
    docs: unknown[];
  };
  assert.equal(since.docs.length, 1);
  const bad = await call("POST", "/batch", {
    writes: [
      { op: "set", collection: "scratch", doc_id: "c", data: { n: 1 } },
      {
        op: "set",
        collection: "scratch",
        doc_id: "a",
        data: { n: 9 },
        if_version: 7,
      },
    ],
  });
  assert.equal(bad.status, 409);
  assert.equal((await call("GET", "?collection=scratch&id=c")).status, 404);
  const ok = await call("POST", "/batch", {
    writes: [{ op: "set", collection: "scratch", doc_id: "c", data: { n: 1 } }],
  });
  assert.equal(ok.status, 200);
  assert.equal((await call("GET", "?collection=scratch&id=c")).status, 200);
});

test("there is no delete, and the bearer token is required", async () => {
  const call = await setup();
  assert.equal((await call("DELETE", "?collection=scratch&id=a")).status, 403);
  assert.equal(
    (await call("GET", "?collection=scratch", undefined, "wrong")).status,
    401,
  );
  assert.equal(
    (await call("GET", "?collection=scratch", undefined, "sch-t")).status,
    403,
  );
});

test("a note is checked like ev4's Worker: bad shape is 400 on put and batch, createdAt is write-once", async () => {
  const call = await setup();
  const note = {
    schema: 1,
    writer: "page",
    at: "2026-11-02T15:00:00Z",
    source: "v5/test",
    createdAt: "2026-11-02T15:00:00Z",
    title: "T",
    blocks: [],
  };
  const bad = { ...note, html: "<b>x</b>" };
  assert.equal(
    (await call("PUT", "?collection=notes&id=n-a", bad)).status,
    400,
  );
  const batch = {
    writes: [{ op: "set", collection: "notes", doc_id: "n-a", data: bad }],
  };
  assert.equal((await call("POST", "/batch", batch)).status, 400);
  assert.equal(
    (await call("PUT", "?collection=notes&id=n-a", note)).status,
    200,
  );
  const moved = { ...note, createdAt: "2026-11-03T00:00:00Z" };
  assert.equal(
    (await call("PUT", "?collection=notes&id=n-a&if_version=1", moved)).status,
    400,
  );
});

test("size budget: a write over 75% of the ceiling warns, over 90% is refused (CONTRACT §data.size)", async () => {
  const call = await setup();
  const grow = (key: string, n: number, v?: number) =>
    call("POST", "/batch", {
      writes: [
        {
          op: v ? "update" : "set",
          collection: "scratch",
          doc_id: "big",
          data: { [key]: key.repeat(n) },
          if_version: v,
        },
      ],
    });
  const small = (await grow("a", 900_000)).clone();
  assert.equal(small.status, 200);
  assert.equal(
    ((await small.json()) as { warnings?: unknown }).warnings,
    undefined,
  );

  // 1.6 MB of 2 MB: stored, with the warning in the response.
  const warned = await grow("b", 700_000, 1);
  assert.equal(warned.status, 200);
  const body = (await warned.json()) as {
    warnings: {
      collection: string;
      doc_id: string;
      percent: number;
      message: string;
    }[];
  };
  assert.equal(body.warnings.length, 1);
  assert.equal(body.warnings[0]?.doc_id, "big");
  assert.ok((body.warnings[0]?.percent ?? 0) >= 75);

  // 1.85 MB: refused with the reason, and the stored document stays at version 2.
  const refused = await grow("c", 250_000, 2);
  assert.equal(refused.status, 400);
  const err = (await refused.json()) as { error: string };
  assert.match(
    err.error,
    /would be .*% of the .* a stored document can hold.*nothing was written/,
  );
  const got = (await (
    await call("GET", "?collection=scratch&id=big")
  ).json()) as { v: number };
  assert.equal(got.v, 2);
});

test("size budget: a single put over 90% is refused too", async () => {
  const { docsRepo } = await import("../data/index.ts");
  const DB = sqliteD1();
  await DB.prepare(
    "CREATE TABLE docs (c TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  await DB.prepare(
    "CREATE TABLE deletions (c TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (c, id))",
  ).run();
  const logged: string[] = [];
  const repo = docsRepo(DB, {
    clock: () => 1,
    ceiling: 1000,
    onWarn: (w) => logged.push(w.message),
  });
  const ok = await repo.save(
    "s",
    "a",
    JSON.stringify({ t: "x".repeat(800) }),
    null,
  );
  assert.ok(ok.ok && ok.warnings?.length === 1);
  assert.equal(logged.length, 1);
  const no = await repo.save(
    "s",
    "b",
    JSON.stringify({ t: "x".repeat(950) }),
    null,
  );
  assert.ok(
    !no.ok && no.status === 400 && /nothing was written/.test(no.error),
  );
  assert.equal(await repo.get("s", "b"), null);
});
