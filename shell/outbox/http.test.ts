import { expect, test, vi } from "vitest";
import { UNAUTHORIZED_EVENT } from "../../commands/client.ts";
import { docsHttp } from "./http.ts";

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

test("get reads the note row by its id and returns the version and the note, or only the status", async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const row = {
    id: "note_n",
    collection_id: null,
    title: "Fluids",
    body: { blocks: [{ type: "p", runs: [{ text: "x" }] }], createdAt: "2026-11-03T15:00:00.000Z" },
    text: "x",
    earlier_of: null,
    at: 1762182000000,
    v: 7,
    deleted_at: null,
  };
  const ok = docsHttp(
    () => "t",
    async (url, init) => (seen.push({ url, init }), reply(200, row)),
  );
  const got = await ok.transport.get("note_n");
  expect(seen[0]?.url).toBe("/api/v1/notes/note_n");
  expect((seen[0]?.init?.headers as Record<string, string>).authorization).toBe("Bearer t");
  expect(got.status).toBe(200);
  expect(got.version).toBe(7);
  expect(got.data).toMatchObject({ title: "Fluids", blocks: row.body.blocks });
  const gone = docsHttp(
    () => "t",
    async () => reply(404, { error: "not found" }),
  );
  expect(await gone.transport.get("note_n")).toEqual({ status: 404 });
  const off = docsHttp(
    () => "t",
    async () => {
      throw new TypeError("offline");
    },
  );
  await expect(off.transport.get("note_n")).rejects.toThrow();
});

const stubFetch = (f: (url: string) => Response) =>
  vi.stubGlobal("fetch", async (url: string) => f(url));

test("list(notes) reads the note rows as documents, leaves out a bad row; 401 and 503 are refusals", async () => {
  const row = {
    id: "note_n",
    collection_id: null,
    title: "Fluids",
    body: { blocks: [{ type: "p", runs: [{ text: "x" }] }], createdAt: "2026-11-03T15:00:00.000Z" },
    text: "x",
    earlier_of: null,
    at: 1762182000000,
    v: 7,
    deleted_at: null,
  };
  const { list } = docsHttp(() => "t");
  stubFetch((url) => (expect(url).toBe("/api/v1/notes"), reply(200, { rows: [row, { id: "bad" }] })));
  const got = await list("notes");
  expect(got).toHaveLength(1);
  expect(got[0]).toMatchObject({ id: "note_n", v: 7, at: 1762182000000 });
  expect(got[0]?.data).toMatchObject({ title: "Fluids" });
  stubFetch(() => reply(401, {}));
  await expect(list("notes")).rejects.toMatchObject({ status: 401 });
  stubFetch(() => reply(503, {}));
  await expect(list("notes")).rejects.toMatchObject({ status: 503 });
  vi.unstubAllGlobals();
});

test("list reads dates, sets and weak spots from their row routes; a 401 signs out", async () => {
  const urls: string[] = [];
  const { list } = docsHttp(() => "t");
  stubFetch((url) => (
    urls.push(url),
    reply(200, { rows: [{ id: "set_a", v: 2, at: 5, title: "Fluids" }, { v: 1 }] })
  ));
  expect(await list("sets")).toEqual([
    { id: "set_a", v: 2, at: 5, data: { id: "set_a", v: 2, at: 5, title: "Fluids" } },
  ]);
  await list("goals");
  await list("weakspots");
  expect(urls).toEqual(["/api/v1/sets", "/api/v1/goals", "/api/v1/weak-spots"]);
  const signedOut = vi.fn();
  window.addEventListener(UNAUTHORIZED_EVENT, signedOut);
  stubFetch(() => reply(401, {}));
  await expect(list("goals")).rejects.toMatchObject({ status: 401 });
  expect(signedOut).toHaveBeenCalled();
  window.removeEventListener(UNAUTHORIZED_EVENT, signedOut);
  vi.unstubAllGlobals();
});

test("a note command answers with the version it wrote", async () => {
  const seen: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => (
    seen.push(url),
    reply(200, { mode: "direct", result: { id: "note_1", version: 5 } })
  ));
  const { transport } = docsHttp(() => "tok");
  expect(await transport.command("note.save", { id: "note_1" })).toEqual({
    status: 200,
    version: 5,
  });
  expect(seen[0]).toContain("commands/note.save");
  vi.unstubAllGlobals();
});
