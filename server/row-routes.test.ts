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
