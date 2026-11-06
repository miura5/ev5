// plan.approve and plan.put_away act on the plans and plan_items rows (§data.gate, §data.tables), read back as the screens read them.
import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { tablesRepo } from "../data/index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

type DB = Awaited<ReturnType<typeof setup>>["DB"];

/** A plans row (and one item per day) as the job's decision leaves it, written through the gate (§data.gate). */
async function seedPlan(
  DB: DB,
  id: string,
  goal: string,
  days: string[],
  state: "draft" | "in_force" | "put_away" = "draft",
) {
  const t = tablesRepo(DB, { clock: Date.now });
  const sorted = [...days].sort();
  const made = await t.plans.save(
    {
      id,
      goal_id: goal,
      job_id: null,
      state,
      title: id,
      from_day: sorted[0]!,
      to_day: sorted[sorted.length - 1]!,
      summary: null,
    },
    null,
  );
  assert.ok(made.ok);
  for (const [n, day] of days.entries())
    await t.planItems.save(
      {
        id: `pli_${id}-${n}`,
        plan_id: id,
        day,
        pos: n,
        title: "Study",
        minutes: 20,
        time: null,
        origin: "plan",
        linked_kind: null,
        linked_id: null,
        repeat_id: null,
        done_at: null,
      },
      null,
    );
}

test("approving a prep plan puts it in force and putting it away retires it", async () => {
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
      ).json()) as { docs: { id: string; data: Record<string, any> }[] }
    ).docs;
  const edit = async () => (await read("planedits"))[0]?.data;
  await seedPlan(DB, "plan_p1", "e1", ["2999-01-01", "2999-01-02"]);
  await seedPlan(DB, "plan_p2", "e1", ["2999-01-03"]);
  const a = await call("plan.approve", { id: "plan_p1" });
  assert.equal(a.status, 200);
  assert.equal(a.body.result.exam, "e1");
  assert.equal((await edit())?.plan, "plan_p1");
  assert.equal((await call("plan.approve", { id: "plan_p1" })).status, 200); // repeating changes nothing
  assert.equal((await call("plan.approve", { id: "plan_p2" })).status, 200);
  const both = await edit();
  assert.equal(both?.plan, "plan_p2"); // one in force per date: the other is put away
  assert.ok(both?.retired.plan_p1.at);
  assert.equal((await call("plan.put_away", { id: "plan_p2" })).status, 200);
  const away = await edit();
  assert.equal(away?.plan, undefined);
  assert.ok(away?.retired.plan_p2.at);
  assert.equal((await call("plan.approve", { id: "plan_p1" })).status, 200); // back in force, no longer retired
  const back = await edit();
  assert.equal(back?.plan, "plan_p1");
  assert.equal(back?.retired.plan_p1, undefined);
  assert.equal((await call("plan.approve", { id: "nope" })).status, 404);
  assert.equal((await call("plan.put_away", { id: "nope" })).status, 404);
  // The plan's sessions stay listed, put away or not (§delete.soft).
  const plans = await read("plans");
  assert.equal(plans.find((p) => p.id === "plan_p2")?.data.days.length, 1);
  assert.equal(plans.find((p) => p.id === "plan_p1")?.data.days.length, 2);
});

test("approving a plan whose days have all passed is refused with a plain reason", async () => {
  const { DB, call } = await setup();
  await seedPlan(DB, "plan_old", "e1", ["2000-01-01", "2000-01-02"]);
  await seedPlan(DB, "plan_live", "e1", ["2000-01-01", "2999-01-01"]);
  const r = await call("plan.approve", { id: "plan_old" });
  assert.equal(r.status, 409);
  assert.match(JSON.stringify(r.body), /days have all passed.*Plan again/);
  const state = async (id: string) =>
    tablesRepo(DB, { clock: Date.now }).plans.get(id);
  assert.equal((await state("plan_old"))?.state, "draft");
  assert.equal((await call("plan.approve", { id: "plan_live" })).status, 200);
  assert.equal((await state("plan_live"))?.state, "in_force");
});
