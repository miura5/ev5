import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Statement } from "./d1-stores.ts";
import {
  d1CeilingStore,
  d1JobStore,
  d1PlanStore,
  saveOutput,
} from "./d1-stores.ts";
import { memoryStore } from "./ceilings-memory.ts";
import { release, reserve, settle, type CeilingStore } from "./ceilings.ts";
import { newJob, transition, type JobStore } from "./record.ts";

// A real SQLite behind D1's interface (fake-d1 only knows the docs statements): batch is one transaction.
function sqliteD1(): D1Like {
  const sql = new DatabaseSync(":memory:");
  for (const f of ["0002_jobs_ceilings.sql", "0004_ceiling_usage.sql"])
    sql.exec(
      readFileSync(new URL(`../../data/migrations/${f}`, import.meta.url), "utf8"),
    );
  const run = (text: string, args: (string | number | null)[]) => {
    const st = sql.prepare(text);
    return /^\s*(select|with)/i.test(text)
      ? { rows: st.all(...args), changes: 0 }
      : { rows: [], changes: Number(st.run(...args).changes) };
  };
  const prepare = (text: string): D1Statement => {
    let args: (string | number | null)[] = [];
    const st = {
      bind: (...v: (string | number | null)[]) => ((args = v), st),
      first: async () => (run(text, args).rows[0] ?? null) as never,
      all: async () => ({ results: run(text, args).rows as never[] }),
      run: async () => ({ meta: { changes: run(text, args).changes } }),
      exec: () => run(text, args),
    };
    return st as unknown as D1Statement;
  };
  return {
    prepare,
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const out = statements.map((s) =>
          (s as unknown as { exec: () => unknown }).exec(),
        );
        sql.exec("COMMIT");
        return out;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

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

test("d1 plan store keeps content by job id and marks the decision", async () => {
  const applied: string[] = [];
  const s = d1PlanStore(sqliteD1(), () => 1, {
    load: async () => undefined,
    apply: async (j) => (applied.push(j), `plan-${j}`),
  });
  const plan = { summary: "s", tasks: [] };
  assert.equal(await s.putDraft("j", plan), "j:draft");
  await s.putDraft("j", plan);
  assert.deepEqual(await s.getDraft("j"), plan);
  assert.equal(await s.getFailure("j"), undefined);
  await s.putFailure("j", "nope");
  assert.equal(await s.getFailure("j"), "nope");
  await assert.rejects(s.getContext("j"), /no context/);
  assert.equal(await s.approve("j", plan), "plan-j");
  assert.equal(await s.putAway("j"), "j:status");
  assert.deepEqual(applied, ["j"]);
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
    jobId: "j",
    kind: "set-item" as const,
    targetC: "sets",
    targetId: "set1",
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
  assert.equal(await n("own_set_items"), 1);
  assert.equal(await n("drafts"), 1);
  const d = await db
    .prepare("SELECT state, at, v FROM drafts")
    .first<{ state: string; at: number; v: number }>();
  assert.deepEqual({ ...d }, { state: "pending", at: 9, v: 1 });
});
