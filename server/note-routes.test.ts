import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

test("pin, rename, delete and restore work on a note, read through the row routes", async () => {
  const { DB, call } = await setup();
  // pins gain their row columns in 0009 (the shared setup stops at 0006)
  for (const stmt of readFileSync(
    new URL(
      "../data/migrations/0009_collections_pins_expand.sql",
      import.meta.url,
    ),
    "utf8",
  )
    .replace(/--.*$/gm, "")
    .split(";"))
    if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const get = (url: string) =>
    app.request(
      `/api/v1${url}`,
      { headers: { authorization: "Bearer app-t" } },
      env,
    );
  const id = (await call("note.create", {})).body.result.id as string;
  const title = async () =>
    ((await (await get(`/notes/note_${id}`)).json()) as { title: string })
      .title;
  assert.equal((await call("item.pin", { id })).status, 200);
  assert.equal(
    (await call("item.rename", { id, title: "Renamed", if_version: 1 })).status,
    200,
  );
  assert.equal(await title(), "Renamed");
  assert.equal((await call("item.delete", { id })).status, 200);
  assert.equal((await get(`/notes/note_${id}`)).status, 404);
  const gone = (await (await get("/deletions?collection=notes")).json()) as {
    deletions: { id: string; title: string }[];
  };
  assert.deepEqual(
    gone.deletions.map((d) => [d.id, d.title]),
    [[id, "Renamed"]],
  );
  assert.equal((await call("item.restore", { id })).status, 200);
  assert.equal((await get(`/notes/note_${id}`)).status, 200);
  assert.equal(
    (
      await DB.prepare("SELECT count(*) AS n FROM deletions").first<{
        n: number;
      }>()
    )?.n,
    0,
  );
});
