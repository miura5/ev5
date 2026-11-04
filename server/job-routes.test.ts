import test from "node:test";
import assert from "node:assert/strict";
import { fakeWorkflows } from "../jobs/index.ts";
import type { ModelCall } from "../jobs/index.ts";
import app from "./index.ts";
import { runWorkflow } from "./job-run.ts";
import type { JobRunEnv } from "./job-run.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";

const T = new Date("2026-11-03T12:00:00Z");
const item = {
  stem: "Which action is first?",
  type: "single",
  options: ["a", "b", "c", "d"],
  correct: [1],
  rationales: ["w", "r", "w", "w"],
  sourceRef: "e1",
};
const input = {
  variant: "practice",
  targetId: "set-1",
  count: 1,
  objectives: ["Vital signs"],
  excerpts: [{ id: "e1", text: "Pulse is measured..." }],
  drafts: false,
};

function setup() {
  const db = sqliteD1();
  for (const k of ["hourly", "daily", "monthly", "per_job"])
    db.prepare("INSERT INTO claude_settings (key, value, at) VALUES (?, ?, 0)")
      .bind(`ceiling_${k}`, 5_000_000)
      .run();
  const call: ModelCall = async () => ({
    stopReason: "end_turn",
    text: JSON.stringify({ items: [item] }),
    usage: { inputTokens: 2000, outputTokens: 1000 },
  });
  const run: JobRunEnv = {
    db,
    call,
    prompts: {
      practice_set: "write",
      study_plan: "plan",
      study_plan_changes: "chg",
    },
    planHome: { load: async () => undefined, apply: async () => "x" },
    now: () => T,
    newId: () => "h1",
  };
  const wf = fakeWorkflows((step, p) => runWorkflow(run, step, p));
  // The platform binding answers a repeated id by throwing, which cloudflareAdapter turns into 'exists'.
  const JOBS = {
    create: async (o: { id: string; params: unknown }) => {
      const r = await wf.adapter.create(
        o.id,
        o.params as Parameters<typeof wf.adapter.create>[1],
      );
      if (r === "exists") throw new Error("instance.already_exists");
    },
  };
  const env = {
    DB: db,
    JOBS,
    ASSETS: { fetch: async () => new Response("x") },
    TOKEN_APP: "fake-app",
    TOKEN_SCHEDULE: "fake-schedule",
    TOKEN_EXECUTOR: "fake-executor",
  };
  const req = (
    method: string,
    path: string,
    token: string | undefined,
    json?: unknown,
  ) =>
    app.request(
      path,
      {
        method,
        headers: {
          "cf-connecting-ip": "9.9.9.9",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(json === undefined ? {} : { body: JSON.stringify(json) }),
      },
      env,
    );
  return { req, wf, db };
}

test("the app starts a practice set, then reads its status", async () => {
  const { req, wf } = setup();
  const res = await req("POST", "/api/v1/jobs/practice-set", "fake-app", {
    input,
  });
  assert.equal(res.status, 202);
  const { job } = (await res.json()) as { job: { id: string } };
  await wf.idle();
  const st = await req("GET", `/api/v1/jobs/${job.id}`, "fake-app");
  const { status } = (await st.json()) as {
    status: { state: string; link: { home: string } };
  };
  assert.equal(status.state, "done");
  assert.equal(status.link.home, "library");
});

test("a bad input is 400 and starts nothing", async () => {
  const { req, db } = setup();
  const res = await req("POST", "/api/v1/jobs/practice-set", "fake-app", {
    input: { variant: "nope" },
  });
  assert.equal(res.status, 400);
  const n = await db
    .prepare("SELECT COUNT(*) AS n FROM jobs")
    .first<{ n: number }>()
    .catch(() => ({ n: 0 }));
  assert.equal(n?.n, 0);
});

test("an unknown kind or job is 404, a job not waiting cannot continue", async () => {
  const { req, wf } = setup();
  assert.equal(
    (await req("POST", "/api/v1/jobs/nope", "fake-app", {})).status,
    404,
  );
  assert.equal((await req("GET", "/api/v1/jobs/zzz", "fake-app")).status, 404);
  assert.equal(
    (await req("POST", "/api/v1/jobs/zzz/continue", "fake-app", {})).status,
    404,
  );
  const r = await req("POST", "/api/v1/jobs/practice-set", "fake-app", {
    input,
  });
  const { job } = (await r.json()) as { job: { id: string } };
  await wf.idle();
  const c = await req("POST", `/api/v1/jobs/${job.id}/continue`, "fake-app", {
    answer: {},
  });
  assert.equal(c.status, 409);
});

test("a study plan waits for Matt, and his answer continues it once", async () => {
  const { req, wf, db } = setup();
  // A study-plan job record parked at needs-you, as the draft step leaves it.
  const { d1JobStore } = await import("../jobs/index.ts");
  await d1JobStore(db, () => T.getTime()).put({
    id: "sp1",
    kind: "study_plan",
    title: "Study plan",
    state: "needs-you",
    step: "approve",
    reason: "Approve it.",
    costCents: 0,
    createdAt: T.toISOString(),
    updatedAt: T.toISOString(),
    v: 1,
  });
  const active = await req("GET", "/api/v1/jobs", "fake-schedule");
  assert.equal(((await active.json()) as { jobs: unknown[] }).jobs.length, 1);
  const c = await req("POST", "/api/v1/jobs/sp1/continue", "fake-app", {
    answer: { decision: "put_away" },
  });
  assert.equal(c.status, 202);
  assert.equal(
    (await req("POST", "/api/v1/jobs/sp1/continue", "fake-app", {})).status,
    409,
  );
  await wf.idle().catch(() => undefined);
});

test("the schedule token reads jobs but cannot start them or touch ceilings; the executor token reaches neither", async () => {
  const { req } = setup();
  const start = await req(
    "POST",
    "/api/v1/jobs/practice-set",
    "fake-schedule",
    {
      input,
    },
  );
  assert.equal(start.status, 403);
  assert.equal((await req("GET", "/api/v1/jobs", "fake-schedule")).status, 200);
  assert.equal(
    (await req("GET", "/api/v1/ceilings", "fake-schedule")).status,
    403,
  );
  assert.equal(
    (await req("PUT", "/api/v1/ceilings", "fake-schedule", { daily: 1 }))
      .status,
    403,
  );
  assert.equal((await req("GET", "/api/v1/jobs", "fake-executor")).status, 403);
  assert.equal(
    (await req("GET", "/api/v1/ceilings", "fake-executor")).status,
    403,
  );
  assert.equal((await req("GET", "/api/v1/jobs")).status, 401);
});

test("only the app reads and sets ceilings, in whole micro-dollars", async () => {
  const { req } = setup();
  const get = await req("GET", "/api/v1/ceilings", "fake-app");
  assert.deepEqual(await get.json(), {
    ceilings: {
      hourly: 5_000_000,
      daily: 5_000_000,
      monthly: 5_000_000,
      perJob: 5_000_000,
    },
  });
  assert.equal(
    (await req("PUT", "/api/v1/ceilings", "fake-app", { daily: -1 })).status,
    400,
  );
  assert.equal(
    (await req("PUT", "/api/v1/ceilings", "fake-app", { daily: 1.5 })).status,
    400,
  );
  const put = await req("PUT", "/api/v1/ceilings", "fake-app", {
    daily: 2_000_000,
  });
  assert.equal(put.status, 200);
  const again = await req("GET", "/api/v1/ceilings", "fake-app");
  assert.equal(
    ((await again.json()) as { ceilings: { daily: number } }).ceilings.daily,
    2_000_000,
  );
});

test("only the app token acknowledges the spend alert, and it ends done", async () => {
  const { req, db } = setup();
  const { d1JobStore, spendAlertWriter } = await import("../jobs/index.ts");
  await spendAlertWriter(d1JobStore(db, () => T.getTime()))("80%", T);
  const id = "spend-alert:" + T.toISOString().slice(0, 7);
  const url = `/api/v1/jobs/${encodeURIComponent(id)}/dismiss`;
  assert.equal((await req("POST", url, "fake-schedule", {})).status, 403);
  assert.equal((await req("POST", url, "fake-app", {})).status, 200);
  const list = await req("GET", "/api/v1/jobs", "fake-app");
  const jobs = (
    (await list.json()) as { jobs: { id: string; state: string }[] }
  ).jobs;
  assert.equal(
    jobs.find((j) => j.id === id),
    undefined,
  ); // finished jobs leave the list
  assert.equal((await req("POST", url, "fake-app", {})).status, 409);
  assert.equal(
    (await req("POST", "/api/v1/jobs/zzz/dismiss", "fake-app", {})).status,
    404,
  );
});
