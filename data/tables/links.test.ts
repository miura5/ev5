import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";
import { WriteRefused } from "./gate.ts";

const dir = new URL("../migrations/", import.meta.url);
function make() {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(dir)
    .filter((n) => /^\d{4}_.*\.sql$/.test(n))
    .sort())
    db.exec(readFileSync(new URL(f, dir), "utf8"));
  let now = 0;
  return tablesRepo(sqliteD1(db), { clock: () => (now += 1000) });
}
const goal = {
  collection_id: null,
  title: "Midterm",
  kind: "midterm",
  date: "2026-12-01",
  status: "open",
  score: null,
  created_by: "user",
} as const;
const obj = (id: string, num: number) =>
  ({
    id,
    collection_id: "col_a",
    num,
    text: `Objective ${num}`,
    chapters: null,
    source_ref: null,
    created_by: "user",
  }) as const;
const link = (id: string, from_id: string, to_id: string) => ({
  id,
  from_kind: "objective",
  from_id,
  to_kind: "goal" as const,
  to_id,
  by: "user" as const,
  note: null,
});

test("a link needs both ends to exist; objectives reach goals through link rows", async () => {
  const r = make();
  await r.goals.save({ id: "goal_1", ...goal }, null);
  await r.goals.save({ id: "goal_2", ...goal, date: "2026-11-01" }, null);
  await r.objectives.save(obj("obj_2", 2), null);
  await r.objectives.save(obj("obj_1", 1), null);
  await assert.rejects(
    r.links.save(link("link_1", "obj_9", "goal_1"), null),
    WriteRefused,
  );
  await assert.rejects(
    r.links.save(link("link_1", "obj_1", "goal_9"), null),
    WriteRefused,
  );
  assert.ok((await r.links.save(link("link_1", "obj_2", "goal_1"), null)).ok);
  assert.ok((await r.links.save(link("link_2", "obj_1", "goal_1"), null)).ok);
  assert.ok((await r.links.save(link("link_3", "obj_1", "goal_2"), null)).ok);
  assert.deepEqual(await r.objectiveIdsOfGoal("goal_1"), ["obj_1", "obj_2"]);
  assert.deepEqual(await r.goalIdsOfObjective("obj_1"), ["goal_2", "goal_1"]);
  // a pair the table does not allow is refused by the domain rule
  await assert.rejects(
    r.links.save(
      { ...link("link_4", "goal_1", "goal_2"), from_kind: "goal" },
      null,
    ),
    WriteRefused,
  );
  // deleting a goal or a link leaves it out of the reads
  await r.links.remove("link_2", 1);
  assert.deepEqual(await r.objectiveIdsOfGoal("goal_1"), ["obj_2"]);
  await r.goals.remove("goal_2", 1);
  assert.deepEqual(await r.goalIdsOfObjective("obj_1"), []);
  assert.deepEqual(await r.goalIdsOfObjective("obj_2"), ["goal_1"]);
  // a weak spot is linked to a goal directly, and needs a live spot
  await assert.rejects(
    r.links.save(
      { ...link("link_5", "ws_9", "goal_1"), from_kind: "weak_spot" },
      null,
    ),
    WriteRefused,
  );
  await r.weakSpots.save(
    {
      id: "ws_1",
      collection_id: null,
      objective_id: null,
      topic: "T",
      kind: "concept",
      words: null,
      source_line: "s",
      duplicate_of: null,
      proposed: 0,
      created_by: "user",
      pre_read: 0,
      reading_due: null,
    },
    null,
  );
  assert.ok(
    (
      await r.links.save(
        { ...link("link_5", "ws_1", "goal_1"), from_kind: "weak_spot" },
        null,
      )
    ).ok,
  );
});

test("createGoalWithLinks writes the goal and its links together; a missing objective or a taken id leaves nothing", async () => {
  const r = make();
  await r.objectives.save(obj("obj_1", 1), null);
  const made = await r.createGoalWithLinks({ id: "goal_9", ...goal }, [
    link("link_1", "obj_1", "goal_9"),
  ]);
  assert.equal(made.ok, true);
  assert.deepEqual(await r.objectiveIdsOfGoal("goal_9"), ["obj_1"]);
  await assert.rejects(
    r.createGoalWithLinks({ id: "goal_8", ...goal }, [
      link("link_2", "obj_1", "goal_8"),
      link("link_3", "obj_gone", "goal_8"),
    ]),
    WriteRefused,
  );
  assert.equal(await r.goals.get("goal_8", { deleted: true }), null);
  const again = await r.createGoalWithLinks({ id: "goal_9", ...goal }, [
    link("link_4", "obj_1", "goal_9"),
  ]);
  assert.equal(again.ok, false);
  assert.equal((await r.links.list()).length, 1);
});
