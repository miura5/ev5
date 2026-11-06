import test from "node:test";
import assert from "node:assert/strict";
import { d1JobStore, spendAlertWriter } from "../jobs/index.ts";
import type { D1Like } from "../jobs/index.ts";
import { setup } from "./job-routes-setup.test.ts";

type Rec = Parameters<ReturnType<typeof d1JobStore>["put"]>[0];
const base = (over: Partial<Rec>): Rec => ({
  id: "j1",
  kind: "practice_set",
  title: "Practice set",
  state: "running",
  costCents: 0,
  createdAt: "2026-11-04T00:00:00.000Z",
  updatedAt: "2026-11-04T00:00:00.000Z",
  v: 1,
  ...over,
});
const seed = (db: D1Like, over: Partial<Rec>) =>
  d1JobStore(db, () => 1).put(base(over));
const cmd = async (s: ReturnType<typeof setup>, name: string, id: string) => {
  const res = await s.req("POST", `/api/v1/commands/${name}`, "fake-app", {
    input: { id },
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, any>,
  };
};
const stateOf = async (db: D1Like, id: string) =>
  (await d1JobStore(db, () => 1).get(id))?.state;

test("job.stop ends a running, queued or waiting job as failed", async () => {
  const s = setup();
  await seed(s.db, { id: "r", state: "running" });
  await seed(s.db, { id: "q", state: "queued" });
  await seed(s.db, {
    id: "n",
    state: "needs-you",
    reason: "pick",
    step: "ask",
  });
  for (const id of ["r", "q", "n"]) {
    const r = await cmd(s, "job.stop", id);
    assert.equal(r.status, 200, id);
    assert.equal(r.body.result.job.state, "failed");
    assert.equal(r.body.result.job.reason, "Stopped by you.");
    assert.equal(await stateOf(s.db, id), "failed");
  }
});

test("job.stop refuses a finished job and an unknown one", async () => {
  const s = setup();
  await seed(s.db, { id: "f", state: "failed", reason: "x" });
  assert.equal((await cmd(s, "job.stop", "f")).status, 409);
  assert.equal((await cmd(s, "job.stop", "nope")).status, 404);
});

test("job.dismiss closes a spend alert and leaves finished jobs as they are", async () => {
  const s = setup();
  await seed(s.db, { id: "f", state: "failed", reason: "x" });
  const done = await cmd(s, "job.dismiss", "f");
  assert.equal(done.status, 200);
  assert.equal(await stateOf(s.db, "f"), "failed");
  await seed(s.db, { id: "r", state: "running" });
  assert.equal((await cmd(s, "job.dismiss", "r")).status, 409);
  // a needs-you job that is not an alert waits for its answer
  await seed(s.db, { id: "n", state: "needs-you", reason: "pick", step: "a" });
  assert.equal((await cmd(s, "job.dismiss", "n")).status, 409);
  assert.equal(await stateOf(s.db, "n"), "needs-you");
  assert.equal((await cmd(s, "job.dismiss", "nope")).status, 404);
});

test("job.dismiss closes a spend alert", async () => {
  const s = setup();
  const w = spendAlertWriter(d1JobStore(s.db, () => 1));
  await w("80% of the month", new Date("2026-11-04T12:00:00Z"));
  const id = "spend-alert:2026-11";
  const r = await cmd(s, "job.dismiss", id);
  assert.equal(r.status, 200);
  assert.equal(await stateOf(s.db, id), "done");
});

const scope = {
  variant: "practice",
  targetId: "set-1",
  count: 4,
  objectives: ["Vital signs"],
  drafts: false,
};
const keep = (db: D1Like, id: string, body: unknown) =>
  db
    .prepare(
      "INSERT INTO job_plans (job_id, kind, body, at) VALUES (?, 'scope', ?, 0)",
    )
    .bind(id, JSON.stringify(body))
    .run();

test("job.retry_shorter starts a new practice set with half the questions", async () => {
  const s = setup();
  await seed(s.db, { id: "f", state: "failed", reason: "too long" });
  await keep(s.db, "f", scope);
  const r = await cmd(s, "job.retry_shorter", "f");
  assert.equal(r.status, 200);
  const job = r.body.result.job as { id: string };
  assert.notEqual(job.id, "f");
  const params = s.started.at(-1) as unknown as {
    input: { count: number; excerpts: unknown[] };
  };
  assert.equal(params.input.count, 2);
  assert.ok(params.input.excerpts.length > 0);
  const kept = await s.db
    .prepare("SELECT body FROM job_plans WHERE job_id = ? AND kind = 'scope'")
    .bind(job.id)
    .first<{ body: string }>();
  assert.equal(JSON.parse(kept?.body ?? "{}").count, 2);
});

test("job.retry_shorter refuses what it cannot shorten", async () => {
  const s = setup();
  await seed(s.db, { id: "run", state: "running" });
  assert.equal((await cmd(s, "job.retry_shorter", "run")).status, 409);
  await seed(s.db, {
    id: "plan",
    kind: "prep_plan",
    state: "failed",
    reason: "x",
  });
  assert.equal((await cmd(s, "job.retry_shorter", "plan")).status, 409);
  await seed(s.db, { id: "nokept", state: "failed", reason: "x" });
  assert.equal((await cmd(s, "job.retry_shorter", "nokept")).status, 409);
  await seed(s.db, { id: "one", state: "failed", reason: "x" });
  await keep(s.db, "one", { ...scope, count: 1 });
  assert.equal((await cmd(s, "job.retry_shorter", "one")).status, 409);
  assert.equal((await cmd(s, "job.retry_shorter", "nope")).status, 404);
});
