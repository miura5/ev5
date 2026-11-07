import { afterEach, expect, test, vi } from "vitest";
import { ApiError, readRows } from "./client.ts";

afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

test("readRows follows `next` until a page has none, keeping the order", async () => {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (u: string) => {
    urls.push(u);
    return u.endsWith("offset=2")
      ? reply({ rows: [{ id: "c" }] })
      : u.endsWith("offset=1")
        ? reply({ rows: [{ id: "b" }], next: 2 })
        : reply({ rows: [{ id: "a" }], next: 1 });
  });
  const got = await readRows<{ id: string }>("sets", "t", "k");
  expect(got.map((r) => r.id)).toEqual(["a", "b", "c"]);
  expect(urls).toEqual([
    "/api/v1/sets",
    "/api/v1/sets?offset=1",
    "/api/v1/sets?offset=2",
  ]);
});

test("readRows stops on a next that does not advance, and throws on a refused page", async () => {
  vi.stubGlobal("fetch", async () => reply({ rows: [{ id: "a" }], next: 0 }));
  expect(await readRows("sets", "t", "k")).toHaveLength(1);
  let n = 0;
  vi.stubGlobal("fetch", async () =>
    n++ ? reply({}, 500) : reply({ rows: [{ id: "a" }], next: 1 }),
  );
  await expect(readRows("sets", "t", "k")).rejects.toBeInstanceOf(ApiError);
});
