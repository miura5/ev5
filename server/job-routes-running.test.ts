import { test } from "vitest";
import assert from "node:assert/strict";
import { d1JobStore } from "../jobs/index.ts";
import { setup } from "./job-routes-setup.testkit.ts";

test("a running prep plan in the job list names its exam (right after Approve)", async () => {
  const { req, db } = setup();
  await d1JobStore(db, () => Date.now()).put({
    id: "sp3",
    kind: "prep_plan",
    title: "Prep plan",
    state: "running",
    costCents: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    v: 1,
  });
  await db
    .prepare(
      "INSERT INTO job_plans (job_id, kind, body, at) VALUES ('sp3', 'context', ?, 0)",
    )
    .bind(JSON.stringify({ goal: { id: "x1", title: "Exam" } }))
    .run();
  const res = await req("GET", "/api/v1/jobs", "fake-app");
  const { jobs } = (await res.json()) as {
    jobs: { id: string; goalId?: string }[];
  };
  assert.equal(jobs.find((j) => j.id === "sp3")?.goalId, "x1");
});
