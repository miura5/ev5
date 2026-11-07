import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Statement } from "../d1.ts";
import { tablesRepo } from "./tables.ts";

const dir = new URL("../migrations/", import.meta.url);
function make(
  onBad?: (b: { table: string; id: string; reason: string }) => void,
) {
  const failing: { sql: string | null } = { sql: null };
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
        run: async () => {
          if (failing.sql && sql.startsWith(failing.sql))
            throw new Error("boom");
          return {
            meta: { changes: Number(db.prepare(sql).run(...args).changes) },
          };
        },
      };
      return st;
    },
    // One transaction, like D1: if a statement throws, none applies.
    async batch(s) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const x of s) out.push(await x.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  let now = 1_000;
  return {
    db,
    failing,
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
  assert.equal(await repo.deletions.restore("sets", "set_a"), 1);
  assert.equal(await repo.deletions.restore("goals", "goal_a"), 1);
  assert.equal(mark("sets", "set_a").deleted_at, null);
  assert.equal(mark("goals", "goal_a").deleted_at, null);
  assert.equal(mark("sets", "set_a").v, 3);
});

test("a session is soft-deleted by a row mark, hidden from reads and found again for restore", async () => {
  const { db, repo } = make();
  db.exec(
    "INSERT INTO sessions (id, kind, day, status, topic, at) VALUES ('ses_a', 'note', '2026-11-07', 'ended', 'Cardiac', 1)",
  );
  assert.equal(await repo.deletions.markSession("ses_a"), true);
  assert.equal(await repo.deletions.markSession("ses_a"), false);
  assert.equal(await repo.deletions.markSession("ses_missing"), false);
  assert.equal(await repo.sessionBook.get("ses_a"), null);
  assert.deepEqual(await repo.sessionBook.list(), []);
  assert.equal(
    (await repo.sessionBook.get("ses_a", { deleted: true }))?.row.id,
    "ses_a",
  );
  assert.equal(await repo.deletions.restore("sessions", "ses_a"), 1);
  assert.equal((await repo.sessionBook.get("ses_a"))?.row.v, 3);
});

test("a delete and a restore are each one statement: a failing write leaves the row as it was", async () => {
  const { db, repo, failing } = make();
  db.exec(
    "INSERT INTO sets (id, kind, created_by, at) VALUES ('set_f', 'practice', 'matt', 1)",
  );
  const deleted = () =>
    (
      db.prepare("SELECT deleted_at FROM sets WHERE id = 'set_f'").get() as {
        deleted_at: number | null;
      }
    ).deleted_at;

  failing.sql = "UPDATE sets";
  await assert.rejects(repo.deletions.markSet("set_f"));
  assert.equal(deleted(), null);
  failing.sql = null;
  assert.equal(await repo.deletions.markSet("set_f"), true);
  assert.notEqual(deleted(), null);

  failing.sql = "UPDATE sets";
  await assert.rejects(repo.deletions.restore("sets", "set_f"));
  assert.notEqual(deleted(), null);
  failing.sql = null;
  assert.equal(await repo.deletions.restore("sets", "set_f"), 1);
  assert.equal(deleted(), null);
});
