// One command, one batch (§data.gate): when the last statement of set.item_delete or check.answer fails, the earlier ones
// are not applied. A trigger makes the final insert abort, as a real failure midway would.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./matt-handlers-setup.test.ts";

test("set.item_delete: a failing deletions write leaves the item undeleted", async () => {
  const { call, DB } = await setup();
  const set = (await call("set.create", { title: "Fluids" })).body.result.set
    .id as string;
  const q = "Which is normal sodium?\n- 100\n* 140\n- 180";
  const item = (await call("set.item_add", { set, text: q })).body.result.item
    .itemId as string;
  await DB.prepare(
    "CREATE TRIGGER boom BEFORE INSERT ON deletions BEGIN SELECT RAISE(ABORT, 'boom'); END",
  ).run();
  const r = await call("set.item_delete", { set, item });
  assert.notEqual(r.status, 200);
  const row = await DB.prepare("SELECT deleted_at, v FROM set_items").first<{
    deleted_at: number | null;
    v: number;
  }>();
  assert.equal(row!.deleted_at, null);
  assert.equal(row!.v, 1);
  await DB.prepare("DROP TRIGGER boom").run();
  assert.equal((await call("set.item_delete", { set, item })).status, 200);
});

test("check.answer: a failing attempts write leaves no talk line, event or session change", async () => {
  const { call, DB } = await setup();
  const a = (await call("session.start", {})).body.result.id as string;
  const count = async (t: string) =>
    (await DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>())!
      .n;
  const before = [
    await count("talk"),
    await count("session_events"),
    await count("attempts"),
  ];
  const ver = async () =>
    (await DB.prepare("SELECT v FROM sessions").first<{ v: number }>())!.v;
  const v0 = await ver();
  await DB.prepare(
    "CREATE TRIGGER boom BEFORE INSERT ON attempts BEGIN SELECT RAISE(ABORT, 'boom'); END",
  ).run();
  const r = await call("check.answer", { id: a, answer: "Na is 135-145" });
  assert.notEqual(r.status, 200);
  assert.deepEqual(
    [
      await count("talk"),
      await count("session_events"),
      await count("attempts"),
    ],
    before,
  );
  assert.equal(await ver(), v0);
  await DB.prepare("DROP TRIGGER boom").run();
  assert.equal(
    (await call("check.answer", { id: a, answer: "Na is 135-145" })).status,
    200,
  );
  assert.equal(await count("talk"), before[0]! + 1);
});
