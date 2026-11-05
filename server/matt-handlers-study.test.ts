import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./matt-handlers-setup.test.ts";

test("an own set takes items, updates and removes them (softly), and drafts are kept or dropped", async () => {
  const { call, DB } = await setup();
  const set = (await call("set.create", { title: "Fluids" })).body.result.set
    .id as string;
  assert.equal(
    (await call("set.create", { title: "x", type: "cards" })).status,
    400,
  );
  assert.equal(
    (await call("set.update", { id: set, title: "Fluids 2" })).body.result.set
      .title,
    "Fluids 2",
  );
  assert.equal(
    (await call("set.update", { id: "nope", title: "a" })).status,
    404,
  );
  const q = "Which is normal sodium?\n- 100\n* 140\n- 180";
  const item = (await call("set.item_add", { set, text: q })).body.result.item
    .itemId as string;
  assert.equal(
    (await call("set.item_add", { set, text: "no options" })).status,
    400,
  );
  assert.equal(
    (
      await call("set.item_update", {
        set,
        item,
        text: q.replace("140", "138"),
      })
    ).status,
    200,
  );
  assert.equal((await call("set.done", { id: set })).body.result.client, true);
  assert.equal((await call("set.item_delete", { set, item })).status, 200);
  const del = await DB.prepare("SELECT c, id FROM deletions").all<{
    c: string;
    id: string;
  }>();
  assert.deepEqual(
    del.results.map((r) => ({ ...r })),
    [{ c: "own_set_items", id: `${set}/${item}` }],
  );
  // an unverified item is a pending draft
  await DB.prepare(
    "INSERT INTO drafts (id, job_id, kind, target_c, target_id, body, state, at, v) VALUES ('d1', 'j', 'set-item', 'own_sets', ?, ?, 'pending', 1, 1)",
  )
    .bind(
      set,
      JSON.stringify({
        id: "d1",
        stem: "Which is a vital sign?",
        type: "single",
        options: ["a", "b"],
        correct: [0],
      }),
    )
    .run();
  assert.equal(
    (await call("set.unverified_keep", { set, item: "nope" })).status,
    404,
  );
  assert.equal(
    (await call("set.unverified_keep", { set, item: "d1" })).status,
    200,
  );
});

test("studying: the attempt comes first, reveal waits for it, just tell me is logged", async () => {
  const { call, doc, put, DB } = await setup();
  const set = (await call("set.create", { title: "Fluids" })).body.result.set
    .id as string;
  const q = "Which is normal sodium?\n- 100\n* 140\n- 180";
  const item = (await call("set.item_add", { set, text: q })).body.result.item
    .itemId as string;
  assert.equal((await call("study.start", { id: set })).body.result.items, 1);
  assert.equal((await call("study.reveal", { id: item })).status, 409);
  const wrong = await call("study.attempt", { id: item, answer: "0" });
  assert.equal(wrong.body.result.correct, false);
  assert.equal(wrong.body.result.reveal, undefined);
  assert.equal(
    (await call("study.attempt", { id: item, answer: "x" })).status,
    400,
  );
  assert.deepEqual(
    (await call("study.reveal", { id: item })).body.result.reveal.correct,
    [1],
  );
  const told = await call("study.just_tell_me", { id: `${set}/${item}` });
  assert.equal(told.body.result.told, true);
  const rows = await DB.prepare(
    "SELECT key FROM own_attempts ORDER BY key",
  ).all<{ key: string }>();
  assert.deepEqual(
    rows.results.map((r) => r.key),
    ["a1", "a2"],
  );
  assert.equal(
    (await call("study.leave", { id: set })).body.result.client,
    true,
  );

  // an ev4 set: the answer is a new `answers` document
  const ev4 = {
    schema: 3,
    writer: "worker",
    at: "2026-11-01T10:00:00.000Z",
    source: "test",
    kind: "review",
    title: "T",
    items: [
      {
        id: "q1",
        stem: "Which is the normal sodium?",
        type: "single",
        options: ["100", "140", "180"],
        correct: [1],
        rationales: ["a", "b", "c"],
      },
      {
        id: "q2",
        stem: "Dose in mg for 5 mL at 2 mg/mL?",
        type: "numeric",
        answer: 10,
        unit: "mg",
        tolerance: 0.5,
      },
    ],
  };
  await put("sets", "s1", ev4);
  assert.equal((await call("study.start", { id: "s1" })).body.result.items, 2);
  assert.equal((await call("study.reveal", { id: "s1/q1" })).status, 409);
  assert.equal(
    (await call("study.attempt", { id: "s1/q1", answer: "1" })).body.result
      .correct,
    true,
  );
  assert.equal(
    (await call("study.attempt", { id: "s1/q2", answer: "10.2" })).body.result
      .correct,
    true,
  );
  assert.equal((await call("study.reveal", { id: "s1/q1" })).status, 200);
  assert.equal((await call("study.just_tell_me", { id: "s1/q2" })).status, 200);
  const all = await DB.prepare("SELECT id FROM docs WHERE c = 'answers'").all<{
    id: string;
  }>();
  assert.equal(all.results.length, 3);
  assert.equal(
    (await call("study.attempt", { id: "s1/zz", answer: "1" })).status,
    404,
  );
});
