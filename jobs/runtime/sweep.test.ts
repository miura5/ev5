import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { defineJob, newJob } from "./index.ts";
import { sweepStale } from "./sweep.ts";
import { transition, addCost } from "./record.ts";
import type { JobRecord, JobStore } from "./record.ts";
import { forgetKinds } from "./define.ts";

const T0 = "2026-11-03T12:00:00Z";
const at = (min: number) =>
  new Date(Date.parse(T0) + min * 60_000).toISOString();

function memory() {
  const rows = new Map<string, JobRecord>();
  const store: JobStore = {
    get: async (id) => rows.get(id),
    list: async () => [...rows.values()],
    put: async (r) => {
      if ((rows.get(r.id)?.v ?? 0) + 1 !== r.v) return false;
      rows.set(r.id, r);
      return true;
    },
  };
  return { rows, store };
}
const seed = async (
  m: ReturnType<typeof memory>,
  id: string,
  to: "queued" | "running" | "needs-you",
  kind = "sweep_kind",
) => {
  let r = newJob({ id, kind, title: id, at: T0 });
  await m.store.put(r);
  if (to !== 'queued') {
    r = transition(r, { to: 'running', at: T0 });
    await m.store.put(r);
  }
  if (to === 'needs-you') {
    r = transition(r, { to: 'needs-you', at: T0, reason: 'Pick one.', step: 'ask' });
    await m.store.put(r);
  }
  return r;
};

test("sweep", async (t) => {
  forgetKinds();
  const u = z.unknown();
  defineJob({
    kind: "sweep_kind",
    title: "Sweep",
    input: u,
    output: u,
    model: "m",
    maxTokens: 1,
    costCapCents: 1,
    steps: ["a"],
    startedBy: ["matt"],
    executor: "workflow",
    deadlineMinutes: { queued: 10, running: 20 },
    wording: { running: "r", needsYou: "n", done: "d", failed: "f" },
  });

  await t.test(
    "fails queued and running jobs past their deadline, keeping cost",
    async () => {
      const m = memory();
      await seed(m, "q", "queued");
      const r = await seed(m, "r", "running");
      await m.store.put(addCost(r, 7, T0));
    m.rows.get('r')!.updatedAt = T0;
      assert.deepEqual((await sweepStale(m.store, at(21))).sort(), ["q", "r"]);
      assert.equal(m.rows.get("q")!.state, "failed");
      assert.match(m.rows.get("r")!.reason!, /runner was lost/);
      assert.equal(m.rows.get("r")!.costCents, 7);
    },
  );

  await t.test(
    "uses each kind deadline and leaves fresh jobs alone",
    async () => {
      const m = memory();
      await seed(m, "q", "queued");
      await seed(m, "r", "running");
      assert.deepEqual(await sweepStale(m.store, at(15)), ["q"]);
      assert.equal(m.rows.get("r")!.state, "running");
    },
  );

  await t.test("never touches needs-you", async () => {
    const m = memory();
    await seed(m, "n", "needs-you");
    assert.deepEqual(await sweepStale(m.store, at(100000)), []);
    assert.equal(m.rows.get("n")!.state, "needs-you");
  });

  await t.test("a job that finishes during the sweep wins", async () => {
    const m = memory();
    const r = await seed(m, "r", "running");
    const racing: JobStore = {
      ...m.store,
      list: async () => {
        const snapshot = await m.store.list();
        await m.store.put(
          transition(r, {
            to: "done",
            at: at(25),
            output: { home: "library", id: "x" },
          }),
        );
        return snapshot;
      },
    };
    assert.deepEqual(await sweepStale(racing, at(30)), []);
    assert.equal(m.rows.get("r")!.state, "done");
    assert.deepEqual(m.rows.get("r")!.output, { home: "library", id: "x" });
  });

  await t.test("a second sweep changes nothing", async () => {
    const m = memory();
    await seed(m, "q", "queued");
    await sweepStale(m.store, at(30));
    const before = JSON.stringify([...m.rows.values()]);
    assert.deepEqual(await sweepStale(m.store, at(90)), []);
    assert.equal(JSON.stringify([...m.rows.values()]), before);
  });

  await t.test("a kind without its own deadline gets the default", async () => {
    const m = memory();
    await seed(m, "x", "running", "other_kind");
    assert.deepEqual(await sweepStale(m.store, at(30)), []);
    assert.deepEqual(await sweepStale(m.store, at(61)), ["x"]);
  });
});
