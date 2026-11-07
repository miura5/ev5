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
