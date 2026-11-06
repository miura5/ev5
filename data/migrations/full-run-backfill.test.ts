import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const read = (name: string): string =>
  readFileSync(new URL(name, import.meta.url), "utf8");
const migrations = readdirSync(new URL(".", import.meta.url))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();
const sql = read(migrations.find((f) => f.endsWith("_full_run_backfill.sql"))!);

test("the full-run backfill renames a saved mock_exam scope to full_run, leaves the rest, and runs once", () => {
  const db = new DatabaseSync(":memory:");
  for (const m of migrations) db.exec(read(m));
  const put = db.prepare(
    "INSERT INTO job_plans (job_id, kind, body, at) VALUES (?, ?, ?, 1)",
  );
  put.run(
    "j1",
    "scope",
    JSON.stringify({ variant: "mock_exam", count: 40, targetId: "s1" }),
  );
  put.run("j2", "scope", JSON.stringify({ variant: "practice", count: 10 }));
  put.run("j3", "result", JSON.stringify({ variant: "mock_exam" }));
  put.run("j4", "scope", "not json");
  db.exec(sql);
  const once = db
    .prepare("SELECT job_id, kind, body FROM job_plans ORDER BY job_id")
    .all();
  db.exec(sql); // a second run changes nothing
  const rows = db
    .prepare("SELECT job_id, kind, body FROM job_plans ORDER BY job_id")
    .all();
  assert.deepEqual(rows, once);
  const body = (id: string) =>
    rows.find((r) => r.job_id === id)!.body as string;
  assert.deepEqual(JSON.parse(body("j1")), {
    variant: "full_run",
    count: 40,
    targetId: "s1",
  });
  assert.equal(JSON.parse(body("j2")).variant, "practice");
  // only a saved scope carries the variant; other kinds and unreadable bodies are left as they were
  assert.equal(JSON.parse(body("j3")).variant, "mock_exam");
  assert.equal(body("j4"), "not json");
});
