import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadPicture, NO_STORAGE, UPLOAD_FAILED } from "./notePictures.ts";
import { api } from "../../../commands/client.ts";
import { IMG_KEY } from "../../../domain/index.ts";

type Call = { url: string; init: RequestInit };
function stub(status: number) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("", { status });
  }) as never;
  return calls;
}
const png = () => new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" });

test("api sends a raw body with its content type and no JSON", async () => {
  const calls = stub(200);
  const data = new Blob(["x"]);
  await api("note-images/k.png", "tok", { method: "PUT", raw: { data, contentType: "image/png" } });
  const c = calls[0]!;
  assert.equal(c.url, "/api/v1/note-images/k.png");
  assert.equal(c.init.method, "PUT");
  assert.equal(c.init.body, data);
  const h = c.init.headers as Record<string, string>;
  assert.equal(h["content-type"], "image/png");
  assert.equal(h.authorization, "Bearer tok");
});

test("api still sends JSON for body and GET for neither", async () => {
  const calls = stub(200);
  await api("a", "t", { body: { x: 1 } });
  await api("b", "t");
  assert.equal(calls[0]!.init.body, '{"x":1}');
  assert.equal(calls[0]!.init.method, "POST");
  assert.equal(calls[1]!.init.method, "GET");
  assert.equal(calls[1]!.init.body, undefined);
});

test("uploadPicture puts the file through api() under a key domain accepts", async () => {
  const calls = stub(200);
  const r = await uploadPicture(png());
  assert.ok(r.ok);
  if (r.ok) assert.match(r.key, IMG_KEY);
  assert.equal(calls[0]!.init.method, "PUT");
  assert.equal((calls[0]!.init.headers as Record<string, string>)["content-type"], "image/png");
});

test("uploadPicture turns failures into plain messages", async () => {
  stub(503);
  assert.deepEqual(await uploadPicture(png()), { ok: false, message: NO_STORAGE });
  stub(500);
  assert.deepEqual(await uploadPicture(png()), { ok: false, message: UPLOAD_FAILED });
  globalThis.fetch = (async () => {
    throw new Error("x");
  }) as never;
  assert.deepEqual(await uploadPicture(png()), { ok: false, message: UPLOAD_FAILED });
});
