import test from "node:test";
import assert from "node:assert/strict";
import { sqliteD1 } from "./sqlite-d1.testkit.ts";
import {
  d1CeilingStore,
  d1JobStore,
  d1PlanStore,
  saveOutput,
  setPlanState,
} from "./d1-stores.ts";
import { memoryStore } from "./ceilings-memory.testkit.ts";
import { release, reserve, settle, type CeilingStore } from "./ceilings.ts";
import { newJob, transition, type JobStore } from "./record.ts";

const cfg = { hourly: 1000, daily: 5000, monthly: 10000, perJob: 600 };
const now = new Date("2026-11-03T14:30:00Z");
const call = (id: string, amount: number, jobId = "j1") => ({
  id,
  jobId,
  amount,
  now,
});

// The in-memory store and the D1 store pass the same behaviours.
const ceilingImpls: [string, () => CeilingStore][] = [
  ["memory", memoryStore],
  ["d1", () => d1CeilingStore(sqliteD1())],
];
for (const [name, make] of ceilingImpls) {
  test(`${name} ceilings: a hit reserves nothing and names the window`, async () => {
    const s = make();
    assert.equal((await reserve(s, cfg, call("a", 400))).ok, true);
    const r = await reserve(s, cfg, call("b", 400));
    assert.equal(!r.ok && r.window, "job");
    assert.equal(await s.used("hour", "2026-11-03T14"), 400);
    assert.equal(await s.used("month", "2026-11"), 400);
  });
  test(`${name} ceilings: settle, release and the 80% alert`, async () => {
    const s = make();
    const c = { hourly: 100000, daily: 100000, monthly: 1000, perJob: 100000 };
    await reserve(s, c, call("a", 700));
    await settle(s, "a", 600);
    const b = await reserve(s, c, call("b", 300));
    assert.equal(b.ok && b.alert?.needsYou, true);
    await release(s, "b");
    await release(s, "b");
    assert.equal(await s.used("day", "2026-11-03"), 600);
    await assert.rejects(reserve(s, c, call("a", 1)), /already exists/);
  });
  test(`${name} ceilings: settle closes the hold and stores the usage key`, async () => {
    const s = make();
    await reserve(s, cfg, call("j1:hold:a", 300, "j1"));
    assert.equal(await s.findOpen("j1:hold:"), "j1:hold:a");
    await settle(s, "j1:hold:a", 100, "i:s:1");
    assert.equal(await s.findOpen("j1:hold:"), undefined);
    assert.equal(await s.usageSeen("i:s:1"), true);
    await release(s, "j1:hold:a"); // closed: a late release must not take the billed amount back
    assert.equal(await s.used("job", "j1"), 100);
    await assert.rejects(settle(s, "j1:hold:a", 1, "i:s:2"), /no reservation/);
  });
  test(`${name} ceilings: concurrent jobs cannot overspend`, async () => {
    const s = make();
    const c = { ...cfg, perJob: 1000, hourly: 1000 };
    const rs = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => reserve(s, c, call(`r${n}`, 300, `job${n}`))),
    );
    assert.equal(rs.filter((r) => r.ok).length, 3);
    assert.equal(await s.used("hour", "2026-11-03T14"), 900);
  });
}

test("d1 ceilings: a failed reserve leaves every window untouched", async () => {
  const s = d1CeilingStore(sqliteD1());
  await reserve(s, { ...cfg, daily: 100 }, call("a", 90));
  const r = await reserve(s, { ...cfg, daily: 100 }, call("b", 50, "j2"));
  assert.equal(!r.ok && r.window, "day");
  assert.equal(await s.used("job", "j2"), 0);
  assert.equal(await s.used("hour", "2026-11-03T14"), 90);
});

test("d1 job store: create, compare-and-set, list", async () => {
  const db = sqliteD1();
  const s: JobStore = d1JobStore(db, () => 5);
  const j = newJob({
    id: "j1",
    kind: "k",
    title: "t",
    at: "2026-11-03T00:00:00Z",
  });
  assert.equal(await s.put(j), true);
  assert.equal(await s.put(j), false);
  const r = transition(j, { to: "running", at: "2026-11-03T00:01:00Z" });
  assert.equal(await s.put(r), true);
  assert.equal(await s.put(r), false);
  assert.equal((await s.get("j1"))?.state, "running");
  assert.equal(await s.get("nope"), undefined);
  assert.deepEqual(
    (await s.list()).map((x) => x.v),
    [2],
  );
});

const ctx = (goalId: string) => ({
  goal: {
    id: goalId,
    title: "Exam 1",
    kind: "exam" as const,
    date: "2026-11-20",
  },
  today: "2026-11-06",
  days: ["2026-11-06"],
  weakSpots: [],
});
const tasks = [
  { date: "2026-11-08", title: "Review A", minutes: 30, weakSpotId: "ws1" },
  { date: "2026-11-07", title: "Review B", minutes: 20 },
];

test("d1 plan store: approve writes the plan and its items to the tables, once, and a newer plan replaces it", async () => {
  const db = sqliteD1();
  const s = d1PlanStore(db, () => 1000, {
    load: async () => undefined,
  });
  const plan = { summary: "s", tasks };
  await s.putContext("j1", ctx("g1"));
  await s.approve("j1", plan);
  await s.approve("j1", plan); // a retried step writes nothing again
  const q = async (sql: string) =>
    JSON.parse(JSON.stringify((await db.prepare(sql).all()).results));
  assert.deepEqual(
    await q("SELECT id, goal_id, state, from_day, to_day FROM plans"),
    [
      {
        id: "plan_j1",
        goal_id: "g1",
        state: "in_force",
        from_day: "2026-11-07",
        to_day: "2026-11-08",
      },
    ],
  );
  assert.deepEqual(
    await q(
      "SELECT id, plan_id, day, origin, linked_kind, linked_id FROM plan_items ORDER BY pos",
    ),
    [
      {
        id: "pli_j1-1",
        plan_id: "plan_j1",
        day: "2026-11-08",
        origin: "plan",
        linked_kind: "weak_spot",
        linked_id: "ws1",
      },
      {
        id: "pli_j1-2",
        plan_id: "plan_j1",
        day: "2026-11-07",
        origin: "plan",
        linked_kind: null,
        linked_id: null,
      },
    ],
  );
  await s.putContext("j2", ctx("g1"));
  await s.approve("j2", plan);
  assert.deepEqual(await q("SELECT id, state FROM plans ORDER BY id"), [
    { id: "plan_j1", state: "put_away" },
    { id: "plan_j2", state: "in_force" },
  ]);
});

test("d1 plan store: a plan.approve racing the job's approve on one plan leaves one plan in force and no duplicate items", async () => {
  const db = sqliteD1();
  const s = d1PlanStore(db, () => 1000, { load: async () => undefined });
  const plan = { summary: "s", tasks };
  await s.putContext("j1", ctx("g1"));
  await s.approve("j1", plan);
  await s.putContext("j2", ctx("g1"));
  // plan_j2 is the goal's newer plan; its job approve and a plan.approve (setPlanState) run together.
  await Promise.allSettled([
    s.approve("j2", plan),
    setPlanState(db, () => 1000, "plan_j2", "in_force"),
    setPlanState(db, () => 1000, "plan_j2", "in_force"),
  ]);
  const q = async (sql: string) =>
    JSON.parse(JSON.stringify((await db.prepare(sql).all()).results));
  assert.deepEqual(await q("SELECT id, state FROM plans ORDER BY id"), [
    { id: "plan_j1", state: "put_away" },
    { id: "plan_j2", state: "in_force" },
  ]);
  assert.equal(
    (await q("SELECT id FROM plan_items WHERE plan_id = 'plan_j2'")).length,
    tasks.length,
  );
  assert.equal(
    (await q("SELECT DISTINCT id FROM plan_items")).length,
    2 * tasks.length,
  );
});

test("d1 plan store: put-away writes a put-away plan with no items; the opposite decision is refused", async () => {
  const db = sqliteD1();
  const s = d1PlanStore(db, () => 1000, {
    load: async () => undefined,
  });
  const plan = { summary: "s", tasks };
  await s.putContext("j", ctx("g1"));
  await s.putDraft("j", plan);
  await s.putAway("j");
  await s.putAway("j");
  const n = async (t: string) =>
    (await db.prepare(`SELECT count(*) AS n FROM ${t}`).first<{ n: number }>())
      ?.n;
  assert.equal(await n("plans"), 1);
  assert.equal(await n("plan_items"), 0);
  await assert.rejects(s.approve("j", plan), /already put away/);
});

test("d1 plan store keeps content by job id and marks the decision", async () => {
  const s = d1PlanStore(sqliteD1(), () => 1, {
    load: async () => undefined,
  });
  const plan = { summary: "s", tasks: [] };
  assert.equal(await s.putDraft("j", plan), "j:draft");
  await s.putDraft("j", plan);
  assert.deepEqual(await s.getDraft("j"), plan);
  await assert.rejects(s.getContext("j"), /no context/);
  await s.putContext("j", ctx("g1"));
  assert.equal(await s.approve("j", plan), "plan_j");
  await assert.rejects(s.putAway("j"), /already approved/);
  await s.putContext("k", ctx("g2"));
  await s.putDraft("k", plan);
  assert.equal(await s.putAway("k"), "k:status");
});

test("saveOutput lands items and drafts in one batch and is safe to retry", async () => {
  const db = sqliteD1();
  const item = {
    stem: "s",
    type: "single" as const,
    options: ["a", "b"],
    correct: [0],
    rationales: ["x", "y"],
    sourceRef: "e1",
  };
  const draft = {
    job_id: "j",
    kind: "set-item" as const,
    target_kind: "sets",
    target_id: "set1",
    body: { ...item, sourceRef: null },
  };
  const a = { jobId: "j", targetId: "set1", items: [item], drafts: [draft] };
  assert.deepEqual(await saveOutput(db, () => 9, a), {
    itemIds: ["j:i0"],
    draftIds: ["j:d0"],
  });
  await saveOutput(db, () => 10, a);
  const n = async (t: string) =>
    (await db.prepare(`SELECT count(*) AS n FROM ${t}`).first<{ n: number }>())
      ?.n;
  assert.equal(await n("set_items"), 1);
  assert.equal(await n("drafts"), 1);
  const d = await db
    .prepare("SELECT state, at, v FROM drafts")
    .first<{ state: string; at: number; v: number }>();
  assert.deepEqual({ ...d }, { state: "pending", at: 9, v: 1 });
});
