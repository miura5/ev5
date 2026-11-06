import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

test("changes since send a weak spot from its rows, and its newest event moves it; an old weakspots document is not sent", async () => {
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
  await DB.prepare(
    "INSERT INTO docs (c, id, data, at, v) VALUES ('weakspots', 'old', '{}', 50, 1)",
  ).run();
  await DB.prepare(
    "INSERT INTO weak_spots (id, topic, kind, source_line, proposed, created_by, pre_read, at, v) VALUES ('ws_a', 'T', 'concept', 's', 0, 'user', 0, 100, 1)",
  ).run();
  await DB.prepare(
    "INSERT INTO weak_spot_events (id, weak_spot_id, type, \"by\", at, v) VALUES ('wse_1', 'ws_a', 'seen', 'user', 500, 1)",
  ).run();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const hdr = { authorization: "Bearer app-t" };
  const since = async (n: number) =>
    (
      (await (
        await app.request(`/api/v1/docs?since=${n}`, { headers: hdr }, env)
      ).json()) as {
        docs: { collection: string; id: string; at: number }[];
      }
    ).docs.filter((d) => d.collection === "weakspots");
  assert.deepEqual(
    (await since(0)).map((d) => [d.id, d.at]),
    [["ws_a", 500]],
  );
  assert.deepEqual(await since(500), []);
});
