import test from "node:test";
import assert from "node:assert/strict";
import { d1JobStore } from "../jobs/index.ts";
import { sqliteD1 } from "./sqlite-d1.test.ts";
import { cronFor, runScheduled } from "./scheduled.ts";

const NOW = Date.parse("2026-11-04T12:00:00Z");
const rec = (id: string, updatedAt: string) => ({
  id,
  kind: "practice_set",
  title: "Practice set",
  state: "running" as const,
  costCents: 0,
  createdAt: updatedAt,
  updatedAt,
  v: 1,
});
const CRON = "*/15 * * * *";

test("the 15-minute cron fails a stale job, leaves a fresh one, and a second run changes nothing", async () => {
  const db = sqliteD1();
  const store = d1JobStore(db, () => NOW);
  await store.put(rec("old", "2026-11-04T00:00:00.000Z"));
  await store.put(rec("fresh", new Date(NOW - 60_000).toISOString()));
  assert.deepEqual(await runScheduled({ DB: db as never }, CRON, NOW), ["job_sweep"]);
  const old = await store.get("old");
  assert.equal(old?.state, "failed");
  assert.equal((await store.get("fresh"))?.state, "running");
  const v = old?.v;
  await runScheduled({ DB: db as never }, CRON, NOW + 1000);
  assert.equal((await store.get("old"))?.v, v);
});

test("a cron nothing is scheduled on runs nothing; only every:15m has a cron", async () => {
  assert.deepEqual(await runScheduled({ DB: sqliteD1() as never }, "0 5 * * *", NOW), []);
  assert.equal(cronFor("daily"), null);
  assert.equal(cronFor("every:15m"), CRON);
});
