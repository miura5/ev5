import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";

function setup() {
  const store = new Map<string, ArrayBuffer>();
  const IMAGES = {
    async put(k: string, v: ArrayBuffer) {
      store.set(k, v);
    },
    async get(k: string) {
      const v = store.get(k);
      return v ? { body: new Response(v).body as ReadableStream } : null;
    },
  };
  const env = {
    IMAGES,
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

test("a picture round-trips with its type and nosniff", async () => {
  const call = setup();
  const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const p = await call("PUT", NAME, bytes);
  assert.equal(p.status, 200);
  assert.deepEqual(await p.json(), { key: "note-images/" + NAME });
  const g = await call("GET", NAME);
  assert.equal(g.status, 200);
  assert.equal(g.headers.get("content-type"), "image/png");
  assert.equal(g.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await g.arrayBuffer()), bytes);
  assert.equal((await call("GET", "zzzzzzzzzzzzzzzz.png")).status, 404);
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
  const env = { IMAGES, TOKEN_APP: "app-t", TOKEN_SCHEDULE: "sch-t" } as unknown as Env;
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
  for (const path of ["/api/v1/exports/ev-export-2026-11-05.json", "/api/v1/note-images/exports/x.png"]) {
    const r = await app.request(
      path,
      { method: "PUT", headers: { authorization: "Bearer app-t" }, body },
      env,
    );
    assert.ok(r.status >= 400);
  }
  assert.equal(store.size, 0);
});
