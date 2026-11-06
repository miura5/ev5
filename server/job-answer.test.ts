import test from "node:test";
import assert from "node:assert/strict";
import { d1JobStore } from "../jobs/index.ts";
import { setup, T } from "./job-routes-setup.test.ts";

test("a bad answer is a 400 and the job stays waiting", async () => {
  const { req, db } = setup();
  const store = d1JobStore(db, () => T.getTime());
  await store.put({
    id: "sp3",
    kind: "prep_plan",
    title: "Prep plan",
    state: "needs-you",
    step: "approve",
    reason: "Approve it.",
    costCents: 0,
    createdAt: T.toISOString(),
    updatedAt: T.toISOString(),
    v: 1,
  });
  const u = "/api/v1/jobs/sp3/continue";
  for (const answer of [undefined, { decision: "maybe" }]) {
    assert.equal((await req("POST", u, "fake-app", { answer })).status, 400);
    assert.equal((await store.get("sp3"))?.state, "needs-you");
  }
});
