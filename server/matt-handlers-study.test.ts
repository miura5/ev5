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
    [{ c: "set_items", id: item }],
  );
  // an unverified item is a pending draft
  await DB.prepare(
    "INSERT INTO drafts (id, job_id, kind, target_c, target_id, body, state, at, v) VALUES ('draft_d1', 'j', 'set-item', 'own_sets', ?, ?, 'pending', 1, 1)",
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
    "SELECT id, item_id, item_v, set_id, source, how, answer, score FROM attempts ORDER BY at",
  ).all<Record<string, unknown>>();
  assert.equal(rows.results.length, 2);
  const [a1, a2] = rows.results as Record<string, unknown>[];
  assert.match(String(a1?.id), /^att_/);
  assert.deepEqual(
    [a1?.item_id, a1?.item_v, a1?.set_id, a1?.source, a1?.how, a1?.score],
    [item, 1, set, "run", "chose", 0],
  );
  assert.deepEqual(JSON.parse(String(a1?.answer)), { chosen: [0] });
  assert.deepEqual([a2?.how, a2?.answer, a2?.score], ["told", null, null]);
  assert.equal(
    (
      await DB.prepare("SELECT COUNT(*) AS n FROM own_attempts").first<{
        n: number;
      }>()
    )?.n,
    0,
  );
  // a retry that names the same attempt id is refused, never doubled
  const again = { id: item, answer: "1", attempt: "att_retry1" };
  assert.equal((await call("study.attempt", again)).status, 200);
  assert.equal((await call("study.attempt", again)).status, 409);
  assert.equal(
    (await call("study.just_tell_me", { id: item, attempt: "att_retry1" }))
      .status,
    409,
  );
  assert.equal(
    (
      await DB.prepare("SELECT COUNT(*) AS n FROM attempts").first<{
        n: number;
      }>()
    )?.n,
    3,
  );
  assert.equal(
    (await call("study.leave", { id: set })).body.result.client,
    true,
  );

  // a set the page has no row for is a 404
  assert.equal((await call("study.start", { id: "s1" })).status, 404);
  assert.equal(
    (await call("study.attempt", { id: "s1/zz", answer: "1" })).status,
    404,
  );
});
