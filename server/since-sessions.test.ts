import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

test("changes since send an old session document once, as its session", async () => {
  const DB = sqliteD1();
  for (const f of [
    "0000_baseline",
    "0001_deletions",
    "0003_collections_pins_own",
    "0006_tables",
  ])
    for (const stmt of readFileSync(
      new URL(`../data/migrations/${f}.sql`, import.meta.url),
      "utf8",
    )
      .replace(/--.*$/gm, "")
      .split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  // A session that is still an old document in docs (§data.tables left it behind).
  await DB.prepare(
    "INSERT INTO docs (c, id, data, at, v) VALUES ('sessions', 'old1', '{}', 5, 1)",
  ).run();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const r = await app.request(
    "/api/v1/docs?since=0",
    { headers: { authorization: "Bearer app-t" } },
    env,
  );
  const docs = (
    (await r.json()) as { docs: { collection: string; id: string }[] }
  ).docs;
  assert.equal(docs.filter((d) => d.id === "old1").length, 0);
});
