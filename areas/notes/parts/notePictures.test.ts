import { expect, test } from "vitest";
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
const png = () =>
  new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" });

test("api sends a raw body with its content type and no JSON", async () => {
  const calls = stub(200);
  const data = new Blob(["x"]);
  await api("note-images/k.png", "tok", {
    method: "PUT",
    raw: { data, contentType: "image/png" },
  });
  const c = calls[0]!;
  expect(c.url).toBe("/api/v1/note-images/k.png");
  expect(c.init.method).toBe("PUT");
  expect(c.init.body).toBe(data);
  const h = c.init.headers as Record<string, string>;
  expect(h["content-type"]).toBe("image/png");
  expect(h.authorization).toBe("Bearer tok");
});

test("api still sends JSON for body and GET for neither", async () => {
  const calls = stub(200);
  await api("a", "t", { body: { x: 1 } });
  await api("b", "t");
  expect(calls[0]!.init.body).toBe('{"x":1}');
  expect(calls[0]!.init.method).toBe("POST");
  expect(calls[1]!.init.method).toBe("GET");
  expect(calls[1]!.init.body).toBe(undefined);
});

test("uploadPicture puts the file through api() under a key domain accepts", async () => {
  const calls = stub(200);
  const r = await uploadPicture(png());
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.key).toMatch(IMG_KEY);
  expect(calls[0]!.init.method).toBe("PUT");
  expect(
    (calls[0]!.init.headers as Record<string, string>)["content-type"],
  ).toBe("image/png");
});

test("uploadPicture turns failures into plain messages", async () => {
  stub(503);
  expect(await uploadPicture(png())).toEqual({
    ok: false,
    message: NO_STORAGE,
  });
  stub(500);
  expect(await uploadPicture(png())).toEqual({
    ok: false,
    message: UPLOAD_FAILED,
  });
  globalThis.fetch = (async () => {
    throw new Error("x");
  }) as never;
  expect(await uploadPicture(png())).toEqual({
    ok: false,
    message: UPLOAD_FAILED,
  });
});

test("uploadPicture treats 409 (already stored) as success", async () => {
  stub(409);
  const r = await uploadPicture(png());
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.key).toMatch(IMG_KEY);
});
