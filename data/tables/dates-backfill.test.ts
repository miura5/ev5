import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { migratedDb, sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";

const sql = readFileSync(
  new URL("../migrations/0011_dates_goals_backfill.sql", import.meta.url),
  "utf8",
);

test("migration 0011 copies dates into goals with objective links, folds in edits, and runs once", async () => {
  const db = migratedDb();
  const put = (c: string, id: string, d: object) =>
    db
      .prepare("INSERT INTO docs (c, id, data, at, v) VALUES (?, ?, ?, 5, 2)")
      .run(c, id, JSON.stringify(d));
  db.exec(
    `INSERT INTO objectives (id, collection_id, num, text, created_by, at) VALUES ('obj_1', 'col_x', 1, 'T', 'user', 1);`,
  );
  put("dates", "d1", {
    writer: "page",
    title: "Old",
    kind: "other",
    date: "2026-11-20",
    objectives: ["obj_1", "obj_missing"],
  });
  put("dateedits", "d1", { overrides: { date: "2026-11-21" } });
  put("dates", "d2", { writer: "canvas-sync", title: "Quiz", date: "bad" });
  db.exec("INSERT INTO deletions VALUES ('dates','d2',9)");
  db.exec(sql);
  db.exec(sql); // a second run adds nothing
  const t = tablesRepo(sqliteD1(db), { clock: () => 1 });
  const g1 = await t.goals.get("goal_d1");
  assert.equal(g1?.title, "Old");
  assert.equal(g1?.date, "2026-11-21");
  assert.equal(g1?.created_by, "user");
  const g2 = db
    .prepare(
      "SELECT date, created_by, deleted_at FROM goals WHERE id = 'goal_d2'",
    )
    .get();
  assert.deepEqual({ ...g2 }, { date: null, created_by: "ev", deleted_at: 9 });
  assert.deepEqual(await t.objectiveIdsOfGoal("goal_d1"), ["obj_1"]);
  const n = (q: string) => (db.prepare(q).get() as { n: number }).n;
  assert.equal(n("SELECT count(*) AS n FROM goals"), 2);
  assert.equal(n("SELECT count(*) AS n FROM links"), 1);
  assert.equal(n("SELECT count(*) AS n FROM docs WHERE c = 'dates'"), 2);
});
