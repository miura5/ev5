import test from "node:test";
import assert from "node:assert/strict";
import { jobCeilings, spendAlertWriter } from "./job-ceilings.ts";
import { memoryStore } from "./ceilings-memory.ts";
import type { JobRecord, JobStore } from "./record.ts";

function jobs(): JobStore & { all: Map<string, JobRecord> } {
  const all = new Map<string, JobRecord>();
  return {
    all,
    async get(id) {
      return all.get(id);
    },
    async put(r) {
      all.set(r.id, r);
      return true;
    },
    async list() {
      return [...all.values()];
    },
  };
}

// monthly 1000 micro-dollars = 0.1 cent; use cents: 1 cent = 10_000 micro, so monthly 100 cents = 1_000_000.
const config = async () => ({
  hourly: 1e9,
  daily: 1e9,
  monthly: 1_000_000,
  perJob: 1e9,
});

test("crossing 80% writes one needs-you item for the month, and no repeat", async () => {
  const js = jobs();
  let n = 0;
  const c = jobCeilings(
    memoryStore(),
    config,
    () => new Date("2026-11-04T10:00:00Z"),
    () => String(n++),
    spendAlertWriter(js),
  );
  await c.reserve("j1", 70);
  await c.record("j1:a", "j1", 70);
  assert.equal(js.all.size, 0);
  await c.reserve("j2", 15); // 85 of 100 cents
  await c.record("j2:a", "j2", 15);
  const a = js.all.get("spend-alert:2026-11");
  assert.equal(a?.state, "needs-you");
  assert.equal(a?.kind, "spend-alert");
  assert.match(a?.reason ?? "", /80%/);
  await c.reserve("j3", 5);
  await c.record("j3:a", "j3", 5);
  await c.reserve("j4", 1);
  assert.equal(js.all.size, 1);
  assert.equal(js.all.get("spend-alert:2026-11")?.v, 1);
});

test("a later month gets its own alert", async () => {
  const js = jobs();
  const w = spendAlertWriter(js);
  await w("a", new Date("2026-11-30T23:00:00Z"));
  await w("a", new Date("2026-11-30T23:30:00Z"));
  await w("b", new Date("2026-12-01T00:10:00Z"));
  assert.deepEqual([...js.all.keys()].sort(), [
    "spend-alert:2026-11",
    "spend-alert:2026-12",
  ]);
});
