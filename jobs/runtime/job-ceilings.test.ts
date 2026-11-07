import test from "node:test";
import assert from "node:assert/strict";
import {
  acknowledgeSpendAlert,
  jobCeilings,
  spendAlertWriter,
} from "./job-ceilings.ts";
import { release } from "./ceilings.ts";
import { memoryStore } from "./ceilings-memory.testkit.ts";
import { billedOnThrow, runStructured } from "./output.ts";
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

test("acknowledging the spend alert closes it for good", async () => {
  const js = jobs();
  await spendAlertWriter(js)("80%", new Date("2026-11-04T10:00:00Z"));
  const id = "spend-alert:2026-11";
  const done = await acknowledgeSpendAlert(
    js,
    id,
    new Date("2026-11-04T11:00:00Z"),
  );
  assert.equal(done.state, "done");
  assert.equal(js.all.get(id)?.state, "done");
  await spendAlertWriter(js)("80%", new Date("2026-11-05T10:00:00Z")); // no second alert this month
  assert.equal(js.all.get(id)?.state, "done");
  await assert.rejects(
    acknowledgeSpendAlert(js, id, new Date()),
    /not waiting/,
  );
  await assert.rejects(
    acknowledgeSpendAlert(js, "nope", new Date()),
    /not a spend alert/,
  );
});

const model = "sonnet";
const spec = (call: Parameters<typeof runStructured>[0]["call"]) => ({
  call,
  model,
  system: "s",
  prompt: "p",
  maxTokens: 100,
  schema: {},
  parse: (r: unknown) => r as { a: number },
});

test("a model call that throws on every attempt leaves no hold open", async () => {
  const store = memoryStore();
  const now = new Date("2026-11-04T10:00:00Z");
  const c = jobCeilings(
    store,
    config,
    () => now,
    (() => {
      let n = 0;
      return () => String(n++);
    })(),
  );
  for (let attempt = 1; attempt <= 3; attempt++) {
    await c.reserve("j1", 50);
    await assert.rejects(
      billedOnThrow(
        (cents) => c.record(`i:draft:${attempt}`, "j1", cents),
        () =>
          runStructured(
            spec(async () => {
              throw new Error("network down");
            }),
          ),
      ),
      /network down/,
    );
    assert.equal(await store.findOpen("hold_j1:"), undefined);
  }
  for (const [w, k] of [
    ["hour", "2026-11-04T10"],
    ["day", "2026-11-04"],
    ["month", "2026-11"],
    ["job", "j1"],
  ] as const)
    assert.equal(await store.used(w, k), 0, w);
});

test("a repair call that throws still bills the first call", async () => {
  const store = memoryStore();
  const now = new Date("2026-11-04T10:00:00Z");
  const c = jobCeilings(
    store,
    config,
    () => now,
    () => "x",
  );
  await c.reserve("j1", 50);
  let calls = 0;
  const usage = {
    inputTokens: 1000,
    outputTokens: 1000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  await assert.rejects(
    billedOnThrow(
      (cents) => c.record("i:draft:1", "j1", cents),
      () =>
        runStructured(
          spec(async () => {
            if (calls++) throw new Error("boom");
            return { stopReason: "end_turn", text: "not json", usage };
          }),
        ),
    ),
    /boom/,
  );
  assert.ok((await store.used("job", "j1")) > 0, "first call's cost is kept");
  assert.equal(await store.findOpen("hold_j1:"), undefined);
});

test("a settled hold is closed, found again after a restart, and a repeated key counts once", async () => {
  const store = memoryStore();
  const now = () => new Date("2026-11-04T10:00:00Z");
  const a = jobCeilings(store, config, now, () => "h");
  await a.reserve("j1", 10);
  const b = jobCeilings(store, config, now, () => "z"); // a restarted Worker: no in-memory state
  await b.record("i:s:1", "j1", 4);
  await b.record("i:s:1", "j1", 4);
  assert.equal(await store.used("job", "j1"), 40_000);
  assert.equal(await store.findOpen("hold_j1:"), undefined);
  await release(store, "hold_j1:h"); // a late release of a settled hold changes nothing
  assert.equal(await store.used("job", "j1"), 40_000);
});
