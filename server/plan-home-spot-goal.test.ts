import { test } from "vitest";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { weakSpotsWithGoal } from "./plan-home.ts";
import { sqliteD1 } from "./sqlite-d1.testkit.ts";

test("a weak spot with no objective gets its goal from a direct weak spot -> goal link", async () => {
  const DB = sqliteD1();
  for (const f of ["0000_baseline"])
    for (const stmt of readFileSync(
      new URL(`../data/migrations/${f}.sql`, import.meta.url),
      "utf8",
    )
      .replace(/--.*$/gm, "")
      .split(";"))
      if (stmt.trim()) await DB.prepare(stmt.trim()).run();
  for (const sql of [
    "INSERT INTO goals (id, collection_id, title, kind, date, status, score, created_by, at, v) VALUES ('goal_a', NULL, 'Exam', 'exam', '2026-12-01', 'open', NULL, 'user', 0, 1), ('goal_b', NULL, 'Later', 'exam', '2027-01-01', 'open', NULL, 'user', 0, 1)",
    "INSERT INTO weak_spots (id, topic, kind, source_line, proposed, created_by, pre_read, at, v) VALUES ('ws_a', 'T', 'concept', 's', 0, 'user', 0, 100, 1), ('ws_b', 'U', 'concept', 's', 0, 'user', 0, 100, 1)",
    "INSERT INTO links (id, from_kind, from_id, to_kind, to_id, \"by\", at, v) VALUES ('link_1', 'weak_spot', 'ws_a', 'goal', 'goal_b', 'user', 1, 1), ('link_2', 'weak_spot', 'ws_a', 'goal', 'goal_a', 'user', 1, 1)",
  ])
    await DB.prepare(sql).run();
  const spots = await weakSpotsWithGoal(DB as never, () => 1000);
  const goalOf = (id: string) => spots.find((s) => s.id === id)?.goalDate;
  assert.equal(goalOf("ws_a"), "2026-12-01"); // the soonest linked goal
  assert.equal(goalOf("ws_b"), null);
});
