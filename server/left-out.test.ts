import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

async function migrated() {
  const DB = sqliteD1();
  for (const f of ["0000_baseline"])
    for (const stmt of readFileSync(
      new URL(`../data/migrations/${f}.sql`, import.meta.url),
      "utf8",
    )
      .replace(/--.*$/gm, "")
      .split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  return DB;
}
const put = (
  DB: Awaited<ReturnType<typeof migrated>>,
  id: string,
  status: string,
) =>
  DB.prepare(
    `INSERT INTO goals (id, title, kind, status, created_by, at, v) VALUES ('${id}', 'Midterm', 'midterm', '${status}', 'user', 5000, 1)`,
  ).run();
const get = (DB: unknown, path: string) =>
  app.request(path, { headers: { authorization: "Bearer app-t" } }, {
    DB,
    TOKEN_APP: "app-t",
  } as unknown as Env);

test("a list read says how many stored rows it left out, and logs each under the request id", async () => {
  const DB = await migrated();
  await put(DB, "goal_ok", "open");
  await put(DB, "goal_bad", "no-such-status");
  const lines: string[] = [];
  const warn = console.warn;
  console.warn = (s: string) => lines.push(s);
  try {
    const r = await get(DB, "/api/v1/goals");
    const body = (await r.json()) as {
      rows: { id: string }[];
      left_out?: number;
    };
    assert.deepEqual(
      body.rows.map((d) => d.id),
      ["goal_ok"],
    );
    assert.equal(body.left_out, 1);
    assert.equal(lines.length, 1);
    const line = JSON.parse(lines[0] as string);
    assert.equal(line.event, "row_left_out");
    assert.equal(line.table, "goals");
    assert.equal(line.id, "goal_bad");
    assert.match(line.requestId, /^[0-9a-f-]{36}$/);
    assert.ok(!lines[0]?.includes("Midterm"), "no row text in the log");
  } finally {
    console.warn = warn;
  }
});

test("a list with nothing left out has no left_out field", async () => {
  const DB = await migrated();
  await put(DB, "goal_ok", "open");
  const body = (await (
    await get(DB, "/api/v1/goals")
  ).json()) as object;
  assert.ok(!("left_out" in body));
});
