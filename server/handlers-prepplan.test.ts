import { test } from "vitest";
import assert from "node:assert/strict";
import { d1JobStore } from "../jobs/index.ts";
import type { D1Like } from "../jobs/index.ts";
import { setup } from "./job-routes-setup.testkit.ts";

const cmd = async (
  s: ReturnType<typeof setup>,
  name: string,
  input: unknown,
) => {
  const res = await s.req("POST", `/api/v1/commands/${name}`, "fake-app", {
    input,
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, any>,
  };
};
const waiting = (db: D1Like, id: string, over = {}) =>
  d1JobStore(db, () => 1).put({
    id,
    kind: "prep_plan",
    title: "Prep plan",
    state: "needs-you",
    step: "approve",
    reason: "Approve it.",
    costCents: 0,
    createdAt: "2026-11-04T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
    v: 1,
    ...over,
  });

test("date.plan_with_ev starts the prep plan job for that exam", async () => {
  const s = setup();
  await s.db
    .prepare(
      "INSERT INTO goals (id, collection_id, title, kind, date, status, score, created_by, at, v) VALUES ('goal_x1', NULL, 'Exam', 'exam', '2026-12-01', 'open', NULL, 'user', 0, 1)",
    )
    .run();
  const r = await cmd(s, "date.plan_with_ev", { id: "goal_x1" });
  assert.equal(r.status, 200);
  assert.equal(r.body.result.job.kind, "prep_plan");
  const params = s.started.at(-1) as unknown as { input: unknown };
  assert.deepEqual(params.input, { goalId: "goal_x1" });
});

test("date.plan_with_ev refuses an exam that is not there", async () => {
  const s = setup();
  assert.equal((await cmd(s, "date.plan_with_ev", { id: "nope" })).status, 404);
});

test("plan.ask_changes answers the waiting plan with the change and the note", async () => {
  const s = setup();
  await waiting(s.db, "sp1");
  const r = await cmd(s, "plan.ask_changes", {
    id: "plan-sp1",
    note: "  lighter weekends  ",
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.result.job.state, "running");
  const params = s.started.at(-1) as unknown as { input: unknown };
  assert.deepEqual(params.input, {
    decision: "change",
    note: "lighter weekends",
  });
  // a second tap finds the plan no longer waiting
  assert.equal(
    (await cmd(s, "plan.ask_changes", { id: "sp1", note: "again" })).status,
    409,
  );
});

test("plan.ask_changes refuses what is not a waiting prep plan", async () => {
  const s = setup();
  await waiting(s.db, "other", { kind: "practice_set" });
  await waiting(s.db, "run", { state: "running", step: undefined });
  const ask = (id: string, note = "x") =>
    cmd(s, "plan.ask_changes", { id, note });
  assert.equal((await ask("nope")).status, 404);
  assert.equal((await ask("other")).status, 404);
  assert.equal((await ask("run")).status, 409);
  await waiting(s.db, "sp2");
  assert.equal((await ask("sp2", "y".repeat(2001))).status, 400);
  assert.equal((await ask("sp2", "   ")).status, 400);
});

const context = (db: D1Like, jobId: string, goalId: string) =>
  db
    .prepare(
      "INSERT INTO job_plans (job_id, kind, body, at) VALUES (?, 'context', ?, 0)",
    )
    .bind(jobId, JSON.stringify({ goal: { id: goalId } }))
    .run();

test("a new plan for an exam puts away its older waiting draft and stops its older run", async () => {
  const s = setup();
  await s.db
    .prepare(
      "INSERT INTO goals (id, collection_id, title, kind, date, status, score, created_by, at, v) VALUES ('goal_x1', NULL, 'Exam', 'exam', '2026-12-01', 'open', NULL, 'user', 0, 1), ('goal_x2', NULL, 'Exam', 'exam', '2026-12-01', 'open', NULL, 'user', 0, 1)",
    )
    .run();
  await waiting(s.db, "old-draft");
  await waiting(s.db, "old-run", { state: "running", step: undefined });
  await waiting(s.db, "other-exam");
  await context(s.db, "old-draft", "goal_x1");
  await context(s.db, "old-run", "goal_x1");
  await context(s.db, "other-exam", "goal_x2");
  const r = await cmd(s, "date.plan_with_ev", { id: "goal_x1" });
  assert.equal(r.status, 200);
  const store = d1JobStore(s.db, () => 1);
  const answers = s.started.map(
    (p) => (p as unknown as { input?: { decision?: string } }).input?.decision,
  );
  assert.ok(
    answers.includes("put_away"),
    "the older draft is answered with put away",
  );
  const run = await store.get("old-run");
  assert.equal(run?.state, "failed");
  assert.match(run?.reason ?? "", /newer plan/);
  assert.equal((await store.get("other-exam"))?.state, "needs-you");
});

test("approving a prep plan draft whose days have all passed is refused and the job keeps waiting", async () => {
  const s = setup();
  const { req, db } = s;
  await d1JobStore(db, () => 1).put({
    id: "sp2",
    kind: "prep_plan",
    title: "Prep plan",
    state: "needs-you",
    step: "approve",
    reason: "Approve it.",
    costCents: 0,
    createdAt: "2026-11-04T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
    v: 1,
  });
  await db
    .prepare(
      "INSERT INTO job_plans (job_id, kind, body, at) VALUES ('sp2', 'draft', ?, 0)",
    )
    .bind(
      JSON.stringify({
        summary: "s",
        tasks: [{ date: "2000-01-01", title: "t", minutes: 20 }],
      }),
    )
    .run();
  const r = await req("POST", "/api/v1/jobs/sp2/continue", "fake-app", {
    answer: { decision: "approve" },
  });
  assert.equal(r.status, 409);
  const body = (await r.json()) as { error: string; offer: string };
  assert.match(body.error, /days have all passed/);
  assert.equal(body.offer, "plan_again");
  assert.equal((await d1JobStore(db, () => 1).get("sp2"))?.state, "needs-you");
});

test("date.plan_with_ev plans a date made by date.create (a goals row)", async () => {
  const s = setup();
  const made = await cmd(s, "date.create", {
    title: "Exam 2",
    date: "2026-12-01",
    kind: "exam",
  });
  assert.equal(made.status, 200);
  const id = made.body.result.id as string;
  const r = await cmd(s, "date.plan_with_ev", { id });
  assert.equal(r.status, 200);
  const params = s.started.at(-1) as unknown as { input: unknown };
  assert.deepEqual(params.input, { goalId: id });
});

test("date.plan_with_ev refuses a date whose kind offers no prep plan, and starts nothing", async () => {
  const s = setup();
  const made = await cmd(s, "date.create", {
    title: "Half marathon",
    date: "2026-12-01",
  });
  assert.equal(made.status, 200);
  const r = await cmd(s, "date.plan_with_ev", { id: made.body.result.id });
  assert.equal(r.status, 409);
  assert.match(String(r.body.error), /Half marathon has no prep plan/);
  assert.equal(s.started.length, 0);
});
