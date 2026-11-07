// The plan rows read as rows (plan-wire.ts): each plan with its goal and state, and each item with its plan and day.
import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { d1PlanStore } from "../jobs/index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

type Row = Record<string, any>;

test("plans and plan_items are read as rows, and a put-away plan reads as put away", async () => {
  const { DB, call } = await setup();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const read = async (c: string) =>
    (
      (await (
        await app.request(
          `/api/v1/${c}`,
          { headers: { authorization: "Bearer app-t" } },
          env,
        )
      ).json()) as { rows: Row[] }
    ).rows;
  const { id: goal } = (
    await call("date.create", { title: "Final", date: "2999-12-01" })
  ).body.result;
  const store = d1PlanStore(DB, () => Date.now(), {
    load: async () => undefined,
  });
  const plan = {
    summary: "s",
    tasks: [
      { date: "2999-11-02", title: "B", minutes: 20 },
      { date: "2999-11-01", title: "A", minutes: 30, weakSpotId: "ws_1" },
    ],
  };
  const ctx = { goal: { id: goal, title: "Final" } } as never;
  await store.putContext("j1", ctx);
  await store.approve("j1", plan);
  const [one] = await read("plans");
  assert.equal(one!.id, "plan_j1");
  assert.equal(one!.goal_id, goal);
  assert.equal(one!.state, "in_force");
  assert.deepEqual(
    (await read("plan-items")).map((i) => [i.day, i.title]),
    [
      ["2999-11-01", "A"],
      ["2999-11-02", "B"],
    ],
  );
  assert.equal((await read("plan-items"))[0]!.linked_id, "ws_1");
  await store.putContext("j2", ctx);
  await store.putDraft("j2", plan);
  await store.putAway("j2");
  const states = Object.fromEntries(
    (await read("plans")).map((p) => [p.id, p.state]),
  );
  assert.equal(states.plan_j1, "in_force"); // a put-away draft leaves the plan in force
  assert.equal(states.plan_j2, "put_away");
});
