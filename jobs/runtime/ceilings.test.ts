import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reserve,
  settle,
  release,
  windowKeys,
  validateConfig,
} from "./ceilings.ts";
import { memoryStore } from "./ceilings-memory.testkit.ts";

const cfg = { hourly: 1000, daily: 5000, monthly: 10000, perJob: 600 };
const now = new Date("2026-11-03T14:30:00Z");
const call = (id: string, amount: number, jobId = "j1", at = now) => ({
  id,
  jobId,
  amount,
  now: at,
});

test("windowKeys", () => {
  assert.deepEqual(windowKeys(now, "j"), {
    hour: "2026-11-03T14",
    day: "2026-11-03",
    month: "2026-11",
    job: "j",
  });
});

test("forced per-job hit fails cleanly with a plain reason and reserves nothing", async () => {
  const s = memoryStore();
  assert.equal((await reserve(s, cfg, call("a", 400))).ok, true);
  const r = await reserve(s, cfg, call("b", 400));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.window, "job");
    assert.match(r.reason, /per-job limit/);
    assert.match(r.reason, /Nothing was saved/);
  }
  assert.equal(await s.used("hour", "2026-11-03T14"), 400);
});

test("hourly, daily and monthly hits each name their window", async () => {
  const big = 1_000_000;
  for (const w of ["hour", "day", "month"] as const) {
    const c = {
      hourly: big,
      daily: big,
      monthly: big,
      perJob: big,
      [{ hour: "hourly", day: "daily", month: "monthly" }[w]]: 100,
    };
    const r = await reserve(memoryStore(), c, call("a", 200));
    assert.equal(!r.ok && r.window, w);
  }
});

test("windows reset: next hour starts empty, day keeps counting", async () => {
  const s = memoryStore();
  const c = { ...cfg, hourly: 3000, perJob: 5000 };
  await reserve(s, c, call("a", 2000, "j1"));
  assert.equal(
    (
      await reserve(
        s,
        c,
        call("b", 2000, "j2", new Date("2026-11-03T15:00:00Z")),
      )
    ).ok,
    true,
  );
  const r = await reserve(
    s,
    c,
    call("c", 2000, "j3", new Date("2026-11-03T16:00:00Z")),
  );
  assert.equal(!r.ok && r.window, "day");
});

test("settle replaces the reservation with billed cost; release frees it", async () => {
  const s = memoryStore();
  await reserve(s, cfg, call("a", 500));
  await settle(s, "a", 120);
  assert.equal(await s.used("day", "2026-11-03"), 120);
  await reserve(s, cfg, call("b", 300));
  await release(s, "b");
  assert.equal(await s.used("day", "2026-11-03"), 120);
});

test("80% monthly alert fires once, on crossing", async () => {
  const c = { hourly: 100000, daily: 100000, monthly: 1000, perJob: 100000 };
  const s = memoryStore();
  const a = await reserve(s, c, call("a", 700));
  assert.equal(a.ok && a.alert, undefined);
  const b = await reserve(s, c, call("b", 100));
  assert.equal(b.ok && b.alert?.needsYou, true);
  assert.match((b.ok && b.alert?.line) || "", /80%/);
  const d = await reserve(s, c, call("d", 50));
  assert.equal(d.ok && d.alert, undefined);
});

test("config must be whole non-negative numbers", () => {
  assert.throws(() => validateConfig({ ...cfg, daily: -1 }));
  assert.throws(() => validateConfig({ ...cfg, hourly: 1.5 }));
});
