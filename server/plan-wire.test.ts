// The plan rows read as the documents Today and Library use (plan-wire.ts): the plan's days of tasks, and which plan is in
// force or put away per goal; a goal with no plan row still reads its older documents.
import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { d1PlanStore } from "../jobs/index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

type Doc = { id: string; data: Record<string, any> };

test("plans and planedits are read from the plan rows, and a put-away plan reads as retired", async () => {
  const { DB, call } = await setup();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const read = async (c: string) =>
    (
      (await (
        await app.request(
          `/api/v1/docs?collection=${c}`,
          { headers: { authorization: "Bearer app-t" } },
          env,
        )
      ).json()) as { docs: Doc[] }
    ).docs;
  const { id: goal } = (
    await call("date.create", { title: "Final", date: "2999-12-01" })
  ).body.result;
  const store = d1PlanStore(DB, () => Date.now(), {
    load: async () => undefined,
    apply: async (j) => `plan-${j}`,
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
  assert.equal(one!.data.exam, goal);
  assert.deepEqual(
    one!.data.days.map((d: any) => [d.date, d.tasks.map((t: any) => t.id)]),
    [
      ["2999-11-01", ["j1-2"]],
      ["2999-11-02", ["j1-1"]],
    ],
  );
  assert.equal(one!.data.days[0].tasks[0].ref, "ws_1");
  assert.deepEqual(
    (await read("planedits")).find((d) => d.id === goal)?.data.plan,
    "plan_j1",
  );
  await store.putContext("j2", ctx);
  await store.putDraft("j2", plan);
  await store.putAway("j2");
  const edit = (await read("planedits")).find((d) => d.id === goal)!.data;
  assert.equal(edit.plan, "plan_j1"); // a put-away draft leaves the plan in force
  assert.ok(edit.retired.plan_j2);
});
