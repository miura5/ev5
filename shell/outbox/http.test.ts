import { expect, test, vi } from "vitest";
import { docsHttp } from "./http.ts";

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

test("get reads the note row by its row id and returns the version and the note, or only the status", async () => {
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
  const got = await ok.transport.get("n");
  expect(seen[0]?.url).toBe("/api/v1/notes/note_n");
  expect((seen[0]?.init?.headers as Record<string, string>).authorization).toBe("Bearer t");
  expect(got.status).toBe(200);
  expect(got.version).toBe(7);
  expect(got.data).toMatchObject({ title: "Fluids", blocks: row.body.blocks });
  const gone = docsHttp(
    () => "t",
    async () => reply(404, { error: "not found" }),
  );
  expect(await gone.transport.get("n")).toEqual({ status: 404 });
  const off = docsHttp(
    () => "t",
    async () => {
      throw new TypeError("offline");
    },
  );
  await expect(off.transport.get("n")).rejects.toThrow();
});

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
  const ok = docsHttp(
    () => "t",
    async (url) => (
      expect(url).toBe("/api/v1/notes"),
      reply(200, { rows: [row, { id: "bad" }] })
    ),
  );
  const got = await ok.list("notes");
  expect(got).toHaveLength(1);
  expect(got[0]).toMatchObject({ id: "n", v: 7, at: 1762182000000 });
  expect(got[0]?.data).toMatchObject({ title: "Fluids" });
  const no = docsHttp(
    () => "",
    async () => reply(401, {}),
  );
  await expect(no.list("notes")).rejects.toMatchObject({ status: 401 });
  const bad = docsHttp(
    () => "t",
    async () => reply(503, {}),
  );
  await expect(bad.list("notes")).rejects.toMatchObject({ status: 503 });
});

test("list returns the documents of another collection; 401 says the token was refused", async () => {
  const ok = docsHttp(
    () => "t",
    async (url) => (
      expect(url).toBe("/api/v1/docs?collection=exams"),
      reply(200, { docs: [{ id: "a", v: 1 }] })
    ),
  );
  expect(await ok.list("exams")).toEqual([{ id: "a", v: 1 }]);
  const no = docsHttp(
    () => "",
    async () => reply(401, {}),
  );
  await expect(no.list("exams")).rejects.toMatchObject({ status: 401 });
});

test("a note command answers with the version it wrote", async () => {
  const seen: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => (
    seen.push(url),
    reply(200, { mode: "direct", result: { id: "n-1", version: 5 } })
  ));
  const { transport } = docsHttp(() => "tok");
  expect(await transport.command("note.save", { id: "n-1" })).toEqual({
    status: 200,
    version: 5,
  });
  expect(seen[0]).toContain("commands/note.save");
  vi.unstubAllGlobals();
});
