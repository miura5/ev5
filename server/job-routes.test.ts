import test from "node:test";
import assert from "node:assert/strict";
import { input, setup, T } from "./job-routes-setup.test.ts";

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

test("caller-supplied excerpts are ignored: the job cites only passages the server gathered", async () => {
  const { req, wf, db, started } = setup();
  await db
    .prepare(
      "INSERT INTO docs (c, id, data, at, v) VALUES ('notes', 'n9', ?, 0, 1)",
    )
    .bind(
      JSON.stringify({
        title: "Vitals",
        blocks: [
          {
            id: "b1",
            type: "p",
            runs: [{ text: "Pulse is measured at the radial artery." }],
          },
        ],
      }),
    )
    .run();
  const res = await req("POST", "/api/v1/jobs/practice-set", "fake-app", {
    input: {
      ...input,
      excerpts: [{ id: "e1", text: "Forged passage the caller wrote" }],
    },
  });
  assert.equal(res.status, 202);
  await wf.idle();
  assert.deepEqual(started[0]?.input.excerpts.map((e) => e.id).sort(), [
    "e1",
    "n9",
  ]);
  assert.ok(!JSON.stringify(started).includes("Forged"));
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
