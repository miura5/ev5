import { test } from "vitest";
import assert from "node:assert/strict";
import { tablesRepo } from "../data/index.ts";
import { setup } from "./matt-handlers-setup.testkit.ts";

test("a weak spot is linked to a date with one link row, and unlinked again", async () => {
  const { call, DB } = await setup();
  const t = tablesRepo(DB as never, { clock: () => 1000 });
  await t.weakSpots.save(
    {
      id: "ws_1",
      collection_id: null,
      objective_id: null,
      topic: "Sodium",
      kind: "concept",
      words: null,
      source_line: "E.V. Home",
      duplicate_of: null,
      created_by: "user",
      proposed: 0,
      pre_read: 0,
      reading_due: null,
    },
    null,
  );
  const goal = (id: string, kind: string) =>
    t.goals.save(
      {
        id,
        collection_id: null,
        title: id,
        kind,
        date: "2026-12-01",
        status: "open",
        score: null,
        created_by: "user",
      },
      null,
    );
  await goal("goal_a", "exam");
  await goal("goal_b", "other");
  await goal("goal_c", "mystery");
  const rows = async () =>
    (await t.links.list()).filter((l) => l.from_kind === "weak_spot");

  const first = await call("weakspot.link", { id: "ws_1", goal: "goal_a" });
  assert.equal(first.status, 200);
  const again = await call("weakspot.link", { id: "ws_1", goal: "goal_a" });
  assert.equal(again.body.result.link, first.body.result.link);
  assert.equal(
    (await call("weakspot.link", { id: "ws_1", goal: "goal_b" })).status,
    200,
  );
  const live = await rows();
  assert.equal(live.length, 2);
  assert.ok(live.every((l) => l.by === "user" && l.to_kind === "goal"));

  assert.equal(
    (await call("weakspot.link", { id: "ws_1", goal: "goal_c" })).status,
    409,
  );
  assert.equal(
    (await call("weakspot.link", { id: "ws_1", goal: "nope" })).status,
    404,
  );
  assert.equal(
    (await call("weakspot.link", { id: "zz", goal: "goal_a" })).status,
    404,
  );

  assert.equal(
    (await call("weakspot.unlink", { id: "ws_1", goal: "goal_a" })).status,
    200,
  );
  assert.deepEqual(
    (await rows()).map((l) => l.to_id),
    ["goal_b"],
  );
  assert.equal(
    (await call("weakspot.unlink", { id: "ws_1", goal: "goal_a" })).status,
    200,
  );
  assert.equal(
    (await call("weakspot.link", { id: "ws_1", goal: "goal_a" })).status,
    200,
  );
  assert.equal((await rows()).length, 2);
});
