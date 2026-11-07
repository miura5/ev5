// One command, one batch (§data.gate): when the last statement of check.answer fails, the earlier ones
// are not applied. A trigger makes the final insert abort, as a real failure midway would.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./matt-handlers-setup.test.ts";

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

test("session.end: a failing event write leaves the session running", async () => {
  const { call, DB } = await setup();
  const a = (await call("session.start", {})).body.result.id as string;
  await DB.prepare(
    "CREATE TRIGGER boom BEFORE INSERT ON session_events BEGIN SELECT RAISE(ABORT, 'boom'); END",
  ).run();
  assert.notEqual((await call("session.end", { id: a })).status, 200);
  const st = async () =>
    (await DB.prepare("SELECT status FROM sessions").first<{
      status: string;
    }>())!.status;
  assert.equal(await st(), "active");
  await DB.prepare("DROP TRIGGER boom").run();
  assert.equal((await call("session.end", { id: a })).status, 200);
  assert.equal(await st(), "ended");
});

test("plan.update with a repeat: a failing occurrence write leaves no repeat and no change", async () => {
  const { call, DB } = await setup();
  const id = (await call("plan.create", { title: "Read", date: "2026-11-09" }))
    .body.result.id as string;
  const n = async (t: string) =>
    (await DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>())!
      .n;
  const before = [await n("repeats"), await n("plan_items")];
  await DB.prepare(
    "CREATE TRIGGER boom BEFORE INSERT ON plan_items BEGIN SELECT RAISE(ABORT, 'boom'); END",
  ).run();
  const r = await call("plan.update", { id, repeat: "daily", title: "Read 2" });
  assert.notEqual(r.status, 200);
  assert.deepEqual([await n("repeats"), await n("plan_items")], before);
  await DB.prepare("DROP TRIGGER boom").run();
  const ok = await call("plan.update", {
    id,
    repeat: "daily",
    title: "Read 2",
  });
  assert.equal(ok.status, 200);
  assert.equal(await n("repeats"), 1);
  assert.equal(await n("plan_items"), 15);
});
