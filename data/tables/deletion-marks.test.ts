import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Statement } from "../docs/d1.ts";
import { tablesRepo } from "./tables.ts";

const dir = new URL("../migrations/", import.meta.url);
function make(
  onBad?: (b: { table: string; id: string; reason: string }) => void,
) {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort())
    db.exec(readFileSync(new URL(f, dir), "utf8"));
  const d1: D1Like = {
    prepare(sql) {
      let args: (string | number | null)[] = [];
      const st: D1Statement = {
        bind: (...v) => ((args = v), st),
        first: async <T>() =>
          (db.prepare(sql).get(...args) ?? null) as T | null,
        all: async <T>() => ({ results: db.prepare(sql).all(...args) as T[] }),
        run: async () => ({
          meta: { changes: Number(db.prepare(sql).run(...args).changes) },
        }),
      };
      return st;
    },
    async batch(s) {
      return Promise.all(s.map((x) => x.run()));
    },
  };
  let now = 1_000;
  return {
    db,
    repo: tablesRepo(d1, { clock: () => (now += 1000), onBad }),
  };
}

test("a set and a goal are soft-deleted by a row mark and come back on restore", async () => {
  const { db, repo } = make();
  db.exec(
    "INSERT INTO sets (id, kind, created_by, at) VALUES ('set_a', 'practice', 'matt', 1)",
  );
  db.exec(
    "INSERT INTO goals (id, title, kind, status, created_by, at) VALUES ('goal_a', 'Exam', 'exam', 'open', 'matt', 1)",
  );
  const mark = (t: string, id: string) =>
    db.prepare(`SELECT deleted_at, v FROM ${t} WHERE id = ?`).get(id) as {
      deleted_at: number | null;
      v: number;
    };
  assert.equal(await repo.deletions.markSet("set_a"), true);
  assert.equal(await repo.deletions.markSet("set_a"), false);
  assert.equal(await repo.deletions.markGoal("goal_a"), true);
  assert.equal(await repo.deletions.markGoal("goal_missing"), false);
  assert.notEqual(mark("sets", "set_a").deleted_at, null);
  assert.notEqual(mark("goals", "goal_a").deleted_at, null);
  assert.deepEqual(
    db
      .prepare("SELECT c, id FROM deletions ORDER BY c")
      .all()
      .map((r) => ({ ...r })),
    [
      { c: "exams", id: "goal_a" },
      { c: "sets", id: "set_a" },
    ],
  );
  assert.equal(await repo.deletions.restore("sets", "set_a"), 1);
  assert.equal(await repo.deletions.restore("exams", "goal_a"), 1);
  assert.equal(mark("sets", "set_a").deleted_at, null);
  assert.equal(mark("goals", "goal_a").deleted_at, null);
  assert.equal(mark("sets", "set_a").v, 3);
});
