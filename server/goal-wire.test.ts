// A goal made by date.create reads from /goals/:id without a plan field: the plan comes from the `plans` rows,
// which Library and Today read themselves.
import test from "node:test";
import assert from "node:assert/strict";
import app from "./index.ts";
import type { Env } from "./index.ts";
import { setup } from "./matt-handlers-setup.test.ts";

test("a date made with date.create reads from the goals route with no planId", async () => {
  const { DB, call } = await setup();
  const env = { DB, TOKEN_APP: "app-t" } as unknown as Env;
  const made = await call("date.create", {
    title: "Final exam",
    date: "2999-12-01",
    kind: "exam",
  });
  const { id } = made.body.result;
  const res = await app.request(
    `/api/v1/goals/${id}`,
    { headers: { authorization: "Bearer app-t" } },
    env,
  );
  const goal = (await res.json()) as Record<string, unknown>;
  assert.equal(goal["title"], "Final exam");
  assert.equal("planId" in goal, false);
});
