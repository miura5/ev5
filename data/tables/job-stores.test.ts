import { test } from "node:test";
import assert from "node:assert/strict";
import { migratedDb, sqliteD1 } from "../export/sqlite-d1.testkit.ts";
import { tablesRepo } from "./tables.ts";
import { WriteRefused } from "./gate.ts";

function make() {
  const sql = migratedDb();
  let now = 1000;
  return {
    sql,
    repo: tablesRepo(sqliteD1(sql), { clock: () => (now += 1) }),
  };
}
const rec = (v: number, state: "queued" | "running" = "queued") => ({
  id: "j1",
  kind: "practice-set",
  title: "T",
  state,
  costCents: 0,
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
  v,
});

test("job records: create at v1, update pinned to v-1, stale refused", async () => {
  const { repo } = make();
  assert.equal(await repo.jobRecords.get("j1"), undefined);
  assert.equal(await repo.jobRecords.put(rec(1)), true);
  assert.equal(await repo.jobRecords.put(rec(1)), false);
  assert.equal(await repo.jobRecords.put(rec(3, "running")), false);
  assert.equal(await repo.jobRecords.put(rec(2, "running")), true);
  assert.equal(await repo.jobRecords.put(rec(2, "running")), false);
  assert.equal((await repo.jobRecords.get("j1"))?.state, "running");
  assert.equal((await repo.jobRecords.list()).length, 1);
  await assert.rejects(
    repo.jobRecords.put({ ...rec(1), id: "" }),
    WriteRefused,
  );
});

const limits = [
  { window: "hour" as const, key: "h", limit: 100 },
  { window: "day" as const, key: "d", limit: 150 },
];

test("ceilings: reserve is all or nothing, settle and release move every window", async () => {
  const { repo } = make();
  const c = repo.ceilings;
  assert.deepEqual(await c.reserve({ id: "a:1", amount: 60, limits }), {
    ok: true,
  });
  assert.equal(await c.used("hour", "h"), 60);
  assert.equal(await c.findOpen("a:"), "a:1");
  // hour would reach 120 > 100: refused, and the day window did not move
  assert.deepEqual(await c.reserve({ id: "b:1", amount: 60, limits }), {
    ok: false,
    window: "hour",
    used: 60,
    limit: 100,
  });
  assert.equal(await c.used("day", "d"), 60);
  assert.equal(await c.hold("b:1"), null);
  await assert.rejects(c.reserve({ id: "a:1", amount: 1, limits }));

  await c.settle("a:1", 40, "u1");
  assert.equal(await c.used("hour", "h"), 40);
  assert.equal(await c.usageSeen("u1"), true);
  assert.equal(await c.findOpen("a:"), undefined);
  await assert.rejects(c.settle("a:1", 10, "u2"), /no reservation/);

  await c.reserve({ id: "c:1", amount: 30, limits });
  await c.release("c:1");
  assert.equal(await c.used("hour", "h"), 40);
  await c.release("c:1"); // no-op
  assert.equal(await c.used("hour", "h"), 40);
});

test("ceilings: a repeated usage key rolls the whole settle back", async () => {
  const { repo } = make();
  const c = repo.ceilings;
  await c.reserve({ id: "a:1", amount: 10, limits });
  await c.settle("a:1", 10, "k");
  await c.reserve({ id: "b:1", amount: 20, limits });
  await assert.rejects(c.settle("b:1", 5, "k"));
  assert.equal((await c.hold("b:1"))?.open, true);
  assert.equal(await c.used("hour", "h"), 30);
});

test("job plans: get returns the saved body or undefined", async () => {
  const { repo } = make();
  assert.equal(await repo.jobPlans.get("j1", "draft"), undefined);
  await repo.jobPlans.put("j1", "draft", { a: 1 });
  assert.deepEqual(await repo.jobPlans.get("j1", "draft"), { a: 1 });
});

test("job output: items and drafts land in one batch, a retry changes nothing", async () => {
  const { repo, sql } = make();
  const a = {
    jobId: "j1",
    targetId: "s1",
    items: [{ stem: "q1" }, { stem: "q2" }],
    drafts: [
      {
        job_id: "j1",
        kind: "set-item",
        target_kind: "own_sets",
        target_id: "s1",
        body: { stem: "q3" },
      },
    ],
  };
  const out = await repo.jobOutput.save(a);
  assert.deepEqual(out, {
    itemIds: ["j1:i0", "j1:i1"],
    draftIds: ["j1:d0"],
  });
  await repo.jobOutput.save(a);
  const n = (t: string) =>
    (sql.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  assert.equal(n("set_items"), 2);
  assert.equal(n("drafts"), 1);
  assert.equal(
    (sql.prepare("SELECT state FROM drafts").get() as { state: string }).state,
    "pending",
  );
});
