import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

async function get(DB: unknown, url: string) {
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const r = await app.request(
    `/api/v1${url}`,
    { headers: { authorization: "Bearer app-t" } },
    env,
  );
  return { status: r.status, body: (await r.json()) as Record<string, any> };
}

test("goals and objectives are read as their domain rows; a bad row is counted", async () => {
  const { DB } = await setup();
  await DB.prepare(
    "INSERT INTO goals (id, collection_id, title, kind, date, status, score, created_by, at, v) VALUES ('goal_a', NULL, 'Exam', 'exam', '2026-12-01', 'open', NULL, 'user', 1, 1), ('goal_bad', NULL, 'Bad', 'exam', 'soon', 'open', NULL, 'user', 1, 1)",
  ).run();
  await DB.prepare(
    "INSERT INTO objectives (id, collection_id, num, text, chapters, source_ref, created_by, at, v) VALUES ('obj_1', 'col_1', 1, 'Explain x', '[]', NULL, 'user', 1, 1)",
  ).run();
  const goals = await get(DB, "/goals");
  assert.equal(goals.status, 200);
  assert.deepEqual(
    goals.body["rows"].map((g: { id: string }) => g.id),
    ["goal_a"],
  );
  assert.equal(goals.body["left_out"], 1);
  assert.equal((await get(DB, "/goals/goal_a")).body["title"], "Exam");
  assert.equal((await get(DB, "/goals/goal_bad")).status, 404);
  const objs = await get(DB, "/objectives");
  assert.equal(objs.body["rows"][0].text, "Explain x");
  assert.equal("left_out" in objs.body, false);
  assert.equal((await get(DB, "/objectives/obj_zz")).status, 404);
});

test("weak spots are listed as rows", async () => {
  const { DB } = await setup();
  const w = await get(DB, "/weak-spots");
  assert.equal(w.status, 200);
  assert.deepEqual(w.body["rows"], []);
});

test("sets, items, sessions, notes and links are read as rows; a bad row is counted and left out", async () => {
  const { DB } = await setup();
  const run = (sql: string) => DB.prepare(sql).run();
  await run(
    "INSERT INTO sets (id, collection_id, kind, title, source_kind, source_id, created_by, job_id, focus, asked, at, v) VALUES ('set_a', NULL, 'own', 'Mine', NULL, NULL, 'user', NULL, NULL, NULL, 1, 1), ('set_bad', NULL, 'nope', 'Bad', NULL, NULL, 'user', NULL, NULL, NULL, 1, 1)",
  );
  await run(
    "INSERT INTO sessions (id, kind, note_id, set_id, collection_id, day, status, planned_min, started_at, ended_at, topic, clock, minutes, driver, at, v) VALUES ('ses_a', 'note', NULL, NULL, NULL, '2026-11-07', 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1), ('ses_bad', 'note', NULL, NULL, NULL, '2026-11-07', 'nope', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1)",
  );
  await run(
    "INSERT INTO links (id, from_kind, from_id, to_kind, to_id, \"by\", note, at, v) VALUES ('link_a', 'note', 'note_1', 'goal', 'goal_1', 'user', NULL, 1, 1), ('link_bad', 'goal', 'goal_1', 'goal', 'goal_2', 'user', NULL, 1, 1)",
  );
  await run(
    "INSERT INTO set_items (id, set_id, pos, type, body, objective_id, weak_spot_id, source_ref, at, v) VALUES ('item_bad', 'set_a', 1, 'zzz', '{}', NULL, NULL, NULL, 1, 1)",
  );
  await run(
    "INSERT INTO notes (id, collection_id, title, body, text, earlier_of, at, v) VALUES ('note_bad', NULL, 'Bad', 'not json', '', NULL, 1, 1)",
  );
  for (const [path, good] of [
    ["sets", "set_a"],
    ["sessions", "ses_a"],
    ["links", "link_a"],
  ] as const) {
    const list = await get(DB, `/${path}`);
    assert.equal(list.status, 200);
    assert.deepEqual(
      list.body["rows"].map((r: { id: string }) => r.id),
      [good],
    );
    assert.equal(list.body["left_out"], 1);
    assert.equal((await get(DB, `/${path}/${good}`)).body["id"], good);
  }
  assert.equal((await get(DB, "/sets/set_bad")).status, 404);
  assert.equal((await get(DB, "/links/link_bad")).status, 404);
  for (const path of ["items", "notes"]) {
    const list = await get(DB, `/${path}`);
    assert.deepEqual(list.body["rows"], []);
    assert.equal(list.body["left_out"], 1);
  }
  assert.equal((await get(DB, "/items/item_zz")).status, 404);
});

test("a deleted row is left out of the list and the single read", async () => {
  const { DB } = await setup();
  await DB.prepare(
    "INSERT INTO sets (id, collection_id, kind, title, source_kind, source_id, created_by, job_id, focus, asked, at, v, deleted_at) VALUES ('set_gone', NULL, 'own', 'Old', NULL, NULL, 'user', NULL, NULL, NULL, 1, 2, 5)",
  ).run();
  const list = await get(DB, "/sets");
  assert.deepEqual(list.body["rows"], []);
  assert.equal("left_out" in list.body, false);
  assert.equal((await get(DB, "/sets/set_gone")).status, 404);
});
