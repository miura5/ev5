import { expect, test } from "vitest";
import { docsHttp } from "./http.ts";

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

test("put sends the whole body with the bearer token and the pinned version", async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const { transport } = docsHttp(
    () => "tok",
    async (url, init) => (
      seen.push({ url, init }),
      reply(200, { at: 1, version: 4 })
    ),
  );
  const a = await transport.put("notes", "n-1", '{"a":1}', 3);
  expect(a.status).toBe(200);
  expect(a.version).toBe(4);
  expect(seen[0]?.url).toBe(
    "/api/v1/docs?collection=notes&id=n-1&if_version=3",
  );
  expect(seen[0]?.init?.method).toBe("PUT");
  expect(seen[0]?.init?.body).toBe('{"a":1}');
  expect((seen[0]?.init?.headers as Record<string, string>).authorization).toBe(
    "Bearer tok",
  );
  await transport.put("notes", "n-2", "{}", null);
  expect(seen[1]?.url).toBe("/api/v1/docs?collection=notes&id=n-2");
});

test("put keeps a refusal's status and text; a rejected fetch rejects (offline)", async () => {
  const { transport } = docsHttp(
    () => "",
    async () => reply(409, { error: "stale" }),
  );
  const r = await transport.put("notes", "n", "{}", 1);
  expect(r.status).toBe(409);
  expect(r.text).toContain("stale");
  const off = docsHttp(
    () => "",
    async () => {
      throw new TypeError("offline");
    },
  );
  await expect(off.transport.put("notes", "n", "{}", 1)).rejects.toThrow();
});

test("get returns the version and data, or only the status", async () => {
  const ok = docsHttp(
    () => "t",
    async () => reply(200, { v: 7, data: { x: 1 } }),
  );
  expect(await ok.transport.get("notes", "n")).toEqual({
    status: 200,
    version: 7,
    data: { x: 1 },
  });
  const gone = docsHttp(
    () => "t",
    async () => reply(404, { error: "not found" }),
  );
  expect(await gone.transport.get("notes", "n")).toEqual({ status: 404 });
});

test("list returns the documents; 401 says the token was refused", async () => {
  const ok = docsHttp(
    () => "t",
    async (url) => (
      expect(url).toBe("/api/v1/docs?collection=notes"),
      reply(200, { docs: [{ id: "a", v: 1 }] })
    ),
  );
  expect(await ok.list("notes")).toEqual([{ id: "a", v: 1 }]);
  const no = docsHttp(
    () => "",
    async () => reply(401, {}),
  );
  await expect(no.list("notes")).rejects.toThrow("not accepted");
});
