import test from "node:test";
import assert from "node:assert/strict";
import {
  fakeWorkflows,
  practiceSet,
  startJob,
  workflowExecutor,
  d1JobStore,
} from "../jobs/index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";
import type { ModelCall, StartEnv } from "../jobs/index.ts";
import { runWorkflow } from "./job-run.ts";
import type { JobRunEnv } from "./job-run.ts";

const T = new Date("2026-11-03T12:00:00Z");
const item = (sourceRef: string | null) => ({
  stem: "Which action is first?",
  type: "single",
  options: ["a", "b", "c", "d"],
  correct: [1],
  rationales: ["w", "r", "w", "w"],
  sourceRef,
});
const input = {
  variant: "practice",
  targetId: "set-1",
  count: 2,
  objectives: ["Vital signs"],
  excerpts: [{ id: "e1", text: "Pulse is measured..." }],
  drafts: false,
};

function setup(
  over: { ceiling?: number; call?: ModelCall; settings?: boolean } = {},
) {
  const db = sqliteD1();
  if (over.settings !== false)
    for (const [k, v] of [
      ["ceiling_hourly", 5_000_000],
      ["ceiling_daily", 5_000_000],
      ["ceiling_monthly", 5_000_000],
      ["ceiling_per_job", over.ceiling ?? 5_000_000],
    ] as const)
      db.prepare(
        "INSERT INTO claude_settings (key, value, at) VALUES (?, ?, 0)",
      )
        .bind(k, v)
        .run();
  let calls = 0;
  const call: ModelCall =
    over.call ??
    (async () => {
      calls++;
      return {
        stopReason: "end_turn",
        text: JSON.stringify({ items: [item("e1"), item("e1")] }),
        usage: { inputTokens: 2000, outputTokens: 1000 },
      };
    });
  const run: JobRunEnv = {
    db,
    call,
    prompts: { practice_set: "write", study_plan: "plan", study_plan_changes: "chg" },
    planHome: { load: async () => undefined, apply: async () => "x" },
    now: () => T,
    newId: () => "h1",
  };
  const wf = fakeWorkflows((step, p) => runWorkflow(run, step, p));
  let n = 0;
  const env: StartEnv = {
    store: d1JobStore(db, () => T.getTime()),
    executors: { workflow: workflowExecutor(wf.adapter, practiceSet.kind) },
    now: () => T.toISOString(),
    newId: () => `job${++n}`,
  };
  return { db, env, wf, calls: () => calls };
}

test("a practice set runs through the Workflow: items saved, cost counted, job done", async () => {
  const { db, env, wf, calls } = setup();
  await startJob(env, practiceSet, input, "matt");
  await wf.idle();
  const rec = (await env.store.get("job_job1"))!;
  assert.equal(rec.state, "done", JSON.stringify(rec));
  assert.deepEqual(rec.output, { home: "library", id: "set-1" });
  assert.equal(calls(), 1);
  const items = await db
    .prepare("SELECT COUNT(*) AS n FROM own_set_items WHERE set_id = ?")
    .bind("set-1")
    .first<{ n: number }>();
  assert.equal(items?.n, 2);
  const day = await db
    .prepare("SELECT used FROM ceiling_use WHERE w = 'day'")
    .first<{ used: number }>();
  assert.ok(
    day && day.used > 0 && day.used < 5_000_000,
    "the hold was settled to the real cost",
  );
});

test("starting the same job twice makes one instance", async () => {
  const { env, wf, calls } = setup();
  const rec = await startJob(env, practiceSet, input, "matt");
  await env.executors.workflow!.start(rec.id, rec, input);
  await wf.idle();
  assert.equal(calls(), 1);
});

test("a ceiling hit stops the job before any model call, in plain words", async () => {
  const { env, wf, calls } = setup({ ceiling: 1 });
  await startJob(env, practiceSet, input, "matt");
  await wf.idle();
  const rec = (await env.store.get("job_job1"))!;
  assert.equal(rec.state, "failed");
  assert.match(JSON.stringify(rec), /Stopped before it started/);
  assert.equal(calls(), 0);
});

test("with no ceilings set in settings the documented defaults apply and the job runs", async () => {
  const { env, wf, calls } = setup({ settings: false });
  await startJob(env, practiceSet, input, "matt");
  await wf.idle();
  assert.equal((await env.store.get("job_job1"))!.state, "done");
  assert.equal(calls(), 1);
});

test("a stored ceiling of 0 still stops every call", async () => {
  const { env, wf, calls } = setup({ ceiling: 0 });
  await startJob(env, practiceSet, input, "matt");
  await wf.idle();
  assert.equal((await env.store.get("job_job1"))!.state, "failed");
  assert.equal(calls(), 0);
});

test("a bad model reply fails the job and a step retry does not pay for the call again", async () => {
  let n = 0;
  const bad: ModelCall = async () => (
    n++,
    {
      stopReason: "end_turn",
      text: "not json",
      usage: { inputTokens: 100, outputTokens: 10 },
    }
  );
  const { env, wf } = setup({ call: bad });
  await startJob(env, practiceSet, input, "matt");
  await wf.idle();
  assert.equal((await env.store.get("job_job1"))!.state, "failed");
  assert.equal(n, 2, "the first reply plus the one repair ask, once");
});
