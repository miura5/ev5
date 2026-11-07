import { test } from "vitest";
import assert from "node:assert/strict";
import { migratedDb, sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";
import type { AttemptInput } from "./attempts.ts";
import { WriteRefused } from "./gate.ts";

async function make() {
  let now = 1_000;
  const repo = tablesRepo(sqliteD1(migratedDb()), {
    clock: () => (now += 1000),
  });
  const set = await repo.sets.save(
    {
      id: "set_1",
      collection_id: null,
      kind: "drill",
      title: "Cycles",
      source_kind: null,
      source_id: null,
      created_by: "user",
      job_id: null,
      focus: null,
      asked: null,
    },
    null,
  );
  assert.ok(set.ok, JSON.stringify(set));
  const body = {
    id: "q1",
    stem: "Which first?",
    options: ["a", "b"],
    correct: [0],
  };
  const item = {
    id: "item_1",
    set_id: "set_1",
    pos: 1,
    type: "single",
    body,
    objective_id: null,
    weak_spot_id: null,
    source_ref: null,
  } as const;
  assert.ok((await repo.setBook.addItem(item)).ok);
  return { repo, item };
}
const att: AttemptInput = {
  id: "att_1",
  item_id: "item_1",
  set_id: "set_1",
  session_id: null,
  source: "run",
  how: "chose",
  answer: { chosen: [0] },
  score: 1,
  answered_at: 5,
  was_due: null,
};

test("record files the answer against the item's current version", async () => {
  const { repo, item } = await make();
  const a = await repo.attempts.record(att);
  assert.ok(a.ok && a.row.item_v === 1);
  const edited = await repo.setBook.editItem(item.id, { pos: 2 }, 1);
  assert.ok(edited.ok && edited.row.v === 2);
  const b = await repo.attempts.record({ ...att, id: "att_2" });
  assert.ok(b.ok && b.row.item_v === 2);
  assert.equal((await repo.attempts.get("att_1"))?.item_v, 1);
});

test("a retried id is a conflict and the row is not doubled", async () => {
  const { repo } = await make();
  await repo.attempts.record(att);
  const again = await repo.attempts.record(att);
  assert.deepEqual(again, { ok: false, conflict: true, current: 1 });
  assert.equal((await repo.attempts.list()).length, 1);
});

test("an answer to a missing, deleted or foreign item is refused", async () => {
  const { repo } = await make();
  await assert.rejects(
    repo.attempts.record({ ...att, item_id: "item_9" }),
    WriteRefused,
  );
  await assert.rejects(
    repo.attempts.record({ ...att, set_id: "set_2" }),
    WriteRefused,
  );
  assert.ok((await repo.setBook.removeItem("item_1", 1)).ok);
  await assert.rejects(repo.attempts.record(att), WriteRefused);
  await assert.rejects(
    repo.attempts.record({ ...att, id: "x_1" }),
    WriteRefused,
  );
  assert.equal((await repo.attempts.list()).length, 0);
});

test("a told answer carries no score", async () => {
  const { repo } = await make();
  await assert.rejects(
    repo.attempts.record({ ...att, how: "told", answer: null, score: 0 }),
    WriteRefused,
  );
  const t = await repo.attempts.record({
    ...att,
    how: "told",
    answer: null,
    score: null,
  });
  assert.ok(t.ok);
});
