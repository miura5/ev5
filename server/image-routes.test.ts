import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import app from "./index.ts";
import type { Env } from "./index.ts";

function setup(DB?: unknown) {
  const store = new Map<string, ArrayBuffer>();
  const IMAGES = {
    async put(
      k: string,
      v: ArrayBuffer,
      o?: { onlyIf?: { etagDoesNotMatch?: string } },
    ) {
      if (o?.onlyIf?.etagDoesNotMatch === "*" && store.has(k)) return null;
      store.set(k, v);
      return {};
    },
    async get(k: string) {
      const v = store.get(k);
      return v ? { body: new Response(v).body as ReadableStream } : null;
    },
  };
  const env = {
    IMAGES,
    DB,
    TOKEN_APP: "app-t",
    TOKEN_SCHEDULE: "sch-t",
  } as unknown as Env;
  return (method: string, name: string, body?: Uint8Array, token = "app-t") =>
    app.request(
      "/api/v1/note-images/" + name,
      { method, headers: { authorization: `Bearer ${token}` }, body },
      env,
    );
}
const NAME = "abcdEFGH12345678.png";
const PNG = (...rest: number[]) =>
  new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...rest]);

test("a picture round-trips with its type and nosniff", async () => {
  const call = setup();
  const bytes = PNG(1, 2, 3);
  const p = await call("PUT", NAME, bytes);
  assert.equal(p.status, 200);
  assert.deepEqual(await p.json(), { key: "note-images/" + NAME });
  const g = await call("GET", NAME);
  assert.equal(g.status, 200);
  assert.equal(g.headers.get("content-type"), "image/png");
  assert.equal(g.headers.get("x-content-type-options"), "nosniff");
  assert.equal(g.headers.get("content-security-policy"), "default-src 'none'");
  assert.deepEqual(new Uint8Array(await g.arrayBuffer()), bytes);
  assert.equal((await call("GET", "zzzzzzzzzzzzzzzz.png")).status, 404);
});

test("a second upload to the same key is refused and the first stays", async () => {
  const call = setup();
  const first = PNG(1);
  assert.equal((await call("PUT", NAME, first)).status, 200);
  assert.equal((await call("PUT", NAME, PNG(9, 9))).status, 409);
  const g = await call("GET", NAME);
  assert.deepEqual(new Uint8Array(await g.arrayBuffer()), first);
});

test("only the app token reaches pictures", async () => {
  const call = setup();
  assert.equal((await call("GET", NAME, undefined, "sch-t")).status, 403);
  assert.equal(
    (await call("PUT", NAME, new Uint8Array([1]), "sch-t")).status,
    403,
  );
  assert.equal((await call("GET", NAME, undefined, "nope")).status, 401);
});

test("a malformed key is 400, an empty or huge body is refused", async () => {
  const call = setup();
  for (const bad of [
    "short.png",
    "abcdEFGH12345678.svg",
    "abcdEFGH1234567%2F8.png",
    "abcdEFGH12345678",
  ])
    assert.equal(
      (await call("PUT", bad, new Uint8Array([1]))).status,
      400,
      bad,
    );
  assert.equal((await call("GET", "x.png")).status, 400);
  assert.equal((await call("PUT", NAME, new Uint8Array(0))).status, 400);
  assert.equal(
    (await call("PUT", NAME, new Uint8Array(5 * 1024 * 1024 + 1))).status,
    413,
  );
});

test("no picture route can write or overwrite a key under exports/", async () => {
  const store = new Map<string, ArrayBuffer>();
  const IMAGES = {
    async put(k: string, v: ArrayBuffer) {
      store.set(k, v);
    },
    async get() {
      return null;
    },
  };
  const env = {
    IMAGES,
    TOKEN_APP: "app-t",
    TOKEN_SCHEDULE: "sch-t",
  } as unknown as Env;
  const body = new Uint8Array([1, 2, 3]);
  for (const name of [
    "..%2Fexports%2Fev-export-2026-11-05.json",
    "../exports/ev-export-2026-11-05.json",
    "%2e%2e%2fexports%2fev-export-2026-11-05.json",
    "exports%2Fev-export-2026-11-05.json",
    "abcdEFGH12345678.png%2F..%2F..%2Fexports%2Fx.json",
  ]) {
    for (const token of ["app-t", "sch-t"]) {
      const r = await app.request(
        "/api/v1/note-images/" + name,
        { method: "PUT", headers: { authorization: `Bearer ${token}` }, body },
        env,
      );
      assert.ok(r.status >= 400, `${name} with ${token} got ${r.status}`);
    }
  }
  assert.equal(store.size, 0);
  for (const path of [
    "/api/v1/exports/ev-export-2026-11-05.json",
    "/api/v1/note-images/exports/x.png",
  ]) {
    const r = await app.request(
      path,
      { method: "PUT", headers: { authorization: "Bearer app-t" }, body },
      env,
    );
    assert.ok(r.status >= 400);
  }
  assert.equal(store.size, 0);
});

test("the bytes' magic number must match the key's type", async () => {
  const call = setup();
  assert.equal(
    (
      await call(
        "PUT",
        NAME,
        new Uint8Array([60, 115, 118, 103, 62, 1, 2, 3, 4]),
      )
    ).status,
    415,
  );
  assert.equal((await call("PUT", "abcdEFGH12345678.jpg", PNG(1))).status, 415);
  assert.equal(
    (
      await call(
        "PUT",
        "abcdEFGH12345678.jpg",
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "PUT",
        "abcdEFGH12345679.gif",
        new TextEncoder().encode("GIF89a.."),
      )
    ).status,
    200,
  );
  const webp = new Uint8Array([
    ...new TextEncoder().encode("RIFF"),
    1,
    0,
    0,
    0,
    ...new TextEncoder().encode("WEBPVP8 "),
  ]);
  assert.equal((await call("PUT", "abcdEFGH1234567A.webp", webp)).status, 200);
  assert.equal(
    (await call("GET", NAME)).status,
    404,
    "a refused picture is not stored",
  );
});

test("a picture upload writes one files row with its size and SHA-256", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../data/migrations/0018_files.sql", import.meta.url),
      "utf8",
    ),
  );
  const DB = {
    prepare: (t: string) => {
      let a: (string | number | null)[] = [];
      const st = {
        bind: (...v: (string | number | null)[]) => ((a = v), st),
        first: async () => sql.prepare(t).get(...a) ?? null,
        all: async () => ({ results: sql.prepare(t).all(...a) }),
        run: async () => ({
          meta: { changes: Number(sql.prepare(t).run(...a).changes) },
        }),
      };
      return st;
    },
  };
  const call = setup(DB);
  const bytes = PNG(1, 2, 3);
  assert.equal((await call("PUT", NAME, bytes)).status, 200);
  assert.equal((await call("PUT", NAME, bytes)).status, 409);
  const rows = sql.prepare("SELECT * FROM files").all() as Record<
    string,
    unknown
  >[];
  assert.equal(rows.length, 1);
  const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  assert.equal(rows[0]!.sha256, sha);
  assert.equal(rows[0]!.size, bytes.byteLength);
  assert.equal(rows[0]!.type, "image/png");
  assert.equal(rows[0]!.r2_key, "note-images/" + NAME);
  assert.equal(rows[0]!.id, "file_abcdEFGH12345678");
});
