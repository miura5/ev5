// A goal made by date.create reads as an exam document whose planId is the plan its `plans` rows put in force (or away)
// (goal-wire.ts), so Library and Today find an approved plan for a real date as they do for an older exam.
import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { tablesRepo } from "../data/index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

test("a date made with date.create shows its approved plan as its planId, and keeps it when put away", async () => {
  const { DB, call } = await setup();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const shown = async (path: string) => {
    const body = (await (
      await app.request(
        path,
        { headers: { authorization: "Bearer app-t" } },
        env,
      )
    ).json()) as {
      docs: { collection: string; id: string; data: Record<string, any> }[];
    };
    return body.docs.find((d) => d.id === id && d.collection === "exams")?.data;
  };
  const made = await call("date.create", {
    title: "Pharm final",
    date: "2999-12-01",
    kind: "exam",
  });
  const { id } = made.body.result;
  assert.equal(
    (await shown("/api/v1/docs?collection=exams"))?.planId,
    undefined,
  );
  for (const p of ["plan_a", "plan_b"])
    await tablesRepo(DB, { clock: Date.now }).plans.save(
      {
        id: p,
        goal_id: id,
        job_id: null,
        state: "draft",
        title: null,
        from_day: "2999-11-30",
        to_day: "2999-11-30",
        summary: null,
      },
      null,
    );
  // The goal row itself does not change on Approve; the sync feed still sends it again, with its plan.
  const before = Date.now();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal((await call("plan.approve", { id: "plan_a" })).status, 200);
  assert.equal(
    (await shown("/api/v1/docs?collection=exams"))?.planId,
    "plan_a",
  );
  assert.equal(
    (await shown(`/api/v1/docs?since=${before}`))?.planId,
    "plan_a",
    "the sync feed sends the goal with its plan too",
  );
  assert.equal((await call("plan.put_away", { id: "plan_a" })).status, 200);
  assert.equal(
    (await shown("/api/v1/docs?collection=exams"))?.planId,
    "plan_a",
    "a put-away plan still reads as this date's plan, so it shows as put away",
  );
  assert.equal((await call("plan.approve", { id: "plan_b" })).status, 200);
  assert.equal((await call("plan.put_away", { id: "plan_b" })).status, 200);
  assert.equal(
    (await shown("/api/v1/docs?collection=exams"))?.planId,
    "plan_b",
    "the plan put away last",
  );
});
