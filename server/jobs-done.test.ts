import test from "node:test";
import assert from "node:assert/strict";
import { d1JobStore } from "../jobs/index.ts";
import { setup } from "./job-routes-setup.test.ts";

const rec = (
  id: string,
  state: "done" | "failed" | "running",
  updatedAt: string,
) => ({
  id,
  kind: "prep_plan",
  title: "Prep plan",
  state,
  ...(state === "failed" ? { reason: "No passages." } : {}),
  costCents: 0,
  createdAt: updatedAt,
  updatedAt,
  v: 1,
});

test("GET /jobs?finished=today lists jobs finished today and sessions ended today, not older or running ones", async () => {
  const { req, db } = setup();
  const store = d1JobStore(db, () => 1);
  const now = new Date().toISOString();
  await store.put(rec("d1", "done", now));
  await store.put(rec("f1", "failed", now));
  await store.put(rec("old", "done", "2020-01-01T00:00:00.000Z"));
  await store.put(rec("live", "running", now));
  const ins = (
    id: string,
    status: string,
    endedAt: string | null,
    minutes: number | null,
  ) =>
    db
      .prepare(
        "INSERT INTO sessions (id, kind, day, status, ended_at, minutes, at, v) VALUES (?, 'note', '2026-01-01', ?, ?, ?, 0, 1)",
      )
      .bind(id, status, endedAt === null ? null : Date.parse(endedAt), minutes)
      .run();
  await ins("ses_ss-a", "ended", now, 25);
  await ins("ses_ss-old", "ended", "2020-01-01T00:00:00.000Z", 5);
  await ins("ses_ss-on", "active", null, null);
  const res = await req("GET", "/api/v1/jobs?finished=today", "fake-app");
  const { jobs } = (await res.json()) as {
    jobs: { id: string; state: string; lead: string }[];
  };
  assert.deepEqual(jobs.map((j) => j.id).sort(), ["d1", "f1", "ss-a"]);
  assert.equal(jobs.find((j) => j.id === "ss-a")?.lead, "Studied 25 minutes.");
  assert.equal(jobs.find((j) => j.id === "f1")?.state, "failed");
  const plain = await req("GET", "/api/v1/jobs", "fake-app");
  const open = (await plain.json()) as { jobs: { id: string }[] };
  assert.deepEqual(
    open.jobs.map((j) => j.id),
    ["live"],
  );
});

test("putting a plan away ends it done at once, never running, and Done today words it as put away", async () => {
  const { req, db } = setup();
  const now = new Date().toISOString();
  const store = d1JobStore(db, () => Date.now());
  await store.put({
    ...rec("sp-a", "done", now),
    output: { home: "library", id: "plan-1" },
  });
  await store.put({
    ...rec("sp-b", "done", now),
    state: "needs-you",
    step: "approve",
    reason: "Approve it.",
  } as never);
  const c = await req("POST", "/api/v1/jobs/sp-b/continue", "fake-app", {
    answer: { decision: "put_away" },
  });
  assert.equal(c.status, 202);
  assert.equal((await store.get("sp-b"))?.state, "done");
  const open = (await (
    await req("GET", "/api/v1/jobs", "fake-app")
  ).json()) as { jobs: { id: string }[] };
  assert.deepEqual(open.jobs, []);
  const done = (await (
    await req("GET", "/api/v1/jobs?finished=today", "fake-app")
  ).json()) as {
    jobs: { id: string; lead: string }[];
  };
  assert.equal(
    done.jobs.find((j) => j.id === "sp-a")?.lead,
    "Your prep plan is saved.",
  );
  assert.equal(
    done.jobs.find((j) => j.id === "sp-b")?.lead,
    "Your prep plan was put away.",
  );
});

test("a finished prep plan's Done today entry carries its exam's title, and none when the exam is gone", async () => {
  const { req, db } = setup();
  const store = d1JobStore(db, () => 1);
  const now = new Date().toISOString();
  await store.put(rec("sp-t", "done", now));
  await store.put(rec("sp-x", "done", now));
  const ctx = (job: string, goalId: string) =>
    db
      .prepare(
        "INSERT INTO job_plans (job_id, kind, body, at) VALUES (?, 'context', ?, 0)",
      )
      .bind(job, JSON.stringify({ goal: { id: goalId } }))
      .run();
  await ctx("sp-t", "goal_ex1");
  await ctx("sp-x", "goal_gone");
  await db
    .prepare(
      "INSERT INTO goals (id, collection_id, title, kind, date, status, score, created_by, at, v) VALUES ('goal_ex1', NULL, 'NUR 112 Exam 2', 'exam', '2026-11-20', 'open', NULL, 'user', 0, 1)",
    )
    .run();
  const res = await req("GET", "/api/v1/jobs?finished=today", "fake-app");
  const { jobs } = (await res.json()) as {
    jobs: { id: string; goalTitle?: string }[];
  };
  assert.equal(jobs.find((j) => j.id === "sp-t")?.goalTitle, "NUR 112 Exam 2");
  assert.equal(jobs.find((j) => j.id === "sp-x")?.goalTitle, undefined);
});
