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
  kind: "study_plan",
  title: "Study plan",
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
  const ins = (id: string, data: object) =>
    db
      .prepare(
        "INSERT INTO docs (c, id, data, at, v) VALUES ('sessions', ?, ?, 0, 1)",
      )
      .bind(id, JSON.stringify(data))
      .run();
  await ins("ss-a", { status: "ended", endedAt: now, minutes: 25 });
  await ins("ss-old", {
    status: "ended",
    endedAt: "2020-01-01T00:00:00.000Z",
    minutes: 5,
  });
  await ins("ss-on", { status: "active" });
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
