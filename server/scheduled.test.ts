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
  const ran = await runScheduled({ DB: db as never }, CRON, NOW);
  assert.deepEqual(
    ran.filter((n) => !n.startsWith("skipped:")),
    ["job_sweep"],
  );
  const old = await store.get("old");
  assert.equal(old?.state, "failed");
  assert.equal((await store.get("fresh"))?.state, "running");
  const v = old?.v;
  await runScheduled({ DB: db as never }, CRON, NOW + 1000);
  assert.equal((await store.get("old"))?.v, v);
});

test("a cron nothing is scheduled on runs nothing; only every:15m has a cron", async () => {
  assert.deepEqual(
    await runScheduled({ DB: sqliteD1() as never }, "0 5 * * *", NOW),
    [],
  );
  assert.equal(cronFor("daily"), null);
  assert.equal(cronFor("every:15m"), CRON);
});

import { dueNow, inQuietWindow, SCHEDULED_KINDS } from "./scheduled.ts";

const at = (iso: string) => Date.parse(iso);

test("morning is due at 05:00 Central, once per Central date", () => {
  assert.equal(dueNow("morning", at("2026-11-04T10:44:00Z"), []), false); // 04:44 CST
  assert.equal(dueNow("morning", at("2026-11-04T11:00:00Z"), []), true);
  assert.equal(
    dueNow("morning", at("2026-11-04T11:00:00Z"), ["2026-11-04"]),
    false,
  );
  assert.equal(dueNow("evening", at("2026-11-04T11:00:00Z"), []), false);
});

test("weekly_review is due on Sundays only", () => {
  assert.equal(dueNow("weekly_review", at("2026-11-08T12:00:00Z"), []), true); // Sunday
  assert.equal(dueNow("weekly_review", at("2026-11-09T12:00:00Z"), []), false);
});

test("nothing is due 01:00-03:00 Central, on the fall-back day 2026-11-01", () => {
  assert.equal(inQuietWindow(at("2026-11-01T06:30:00Z")), true); // 01:30 CDT
  assert.equal(inQuietWindow(at("2026-11-01T07:30:00Z")), true); // 01:30 CST, repeated hour
  assert.equal(inQuietWindow(at("2026-11-01T09:00:00Z")), false); // 03:00 CST
  assert.equal(dueNow("morning", at("2026-11-01T10:59:00Z"), []), false); // 04:59 CST
  assert.equal(dueNow("morning", at("2026-11-01T11:00:00Z"), []), true); // 05:00 CST
  assert.equal(dueNow("evening", at("2026-11-02T01:59:00Z"), []), false); // 19:59 CST
  assert.equal(dueNow("evening", at("2026-11-02T02:00:00Z"), []), true);
});

test("the spring-forward day 2027-03-14 has no 02:xx and 05:00 is CDT", () => {
  assert.equal(inQuietWindow(at("2027-03-14T07:30:00Z")), true); // 01:30 CST
  assert.equal(inQuietWindow(at("2027-03-14T08:30:00Z")), false); // 03:30 CDT
  assert.equal(dueNow("morning", at("2027-03-14T09:59:00Z"), []), false); // 04:59 CDT
  assert.equal(dueNow("morning", at("2027-03-14T10:00:00Z"), []), true); // 05:00 CDT
  assert.equal(dueNow("weekly_review", at("2027-03-14T10:00:00Z"), []), true); // a Sunday
});

test("a due command with no job kind is reported as skipped and writes no record", async () => {
  const db = sqliteD1();
  assert.equal(SCHEDULED_KINDS.morning, undefined);
  const out = await runScheduled(
    { DB: db as never },
    CRON,
    at("2026-11-04T12:00:00Z"),
  );
  assert.deepEqual(
    out,
    ["skipped:morning", "job_sweep"].sort(
      (a, b) => out.indexOf(a) - out.indexOf(b),
    ),
  );
  assert.ok(out.includes("skipped:morning") && out.includes("job_sweep"));
  assert.equal((await d1JobStore(db, () => 0).list()).length, 0);
});

test("with a kind attached the run is made once per Central date", async () => {
  SCHEDULED_KINDS.morning = "morning_run";
  try {
    const db = sqliteD1();
    const t = at("2026-11-04T12:00:00Z");
    assert.ok(
      (await runScheduled({ DB: db as never }, CRON, t)).includes("morning"),
    );
    assert.ok(
      !(await runScheduled({ DB: db as never }, CRON, t + 900_000)).includes(
        "morning",
      ),
    );
    assert.equal((await d1JobStore(db, () => 0).list()).length, 1);
    assert.ok(
      (await runScheduled({ DB: db as never }, CRON, t + 86_400_000)).includes(
        "morning",
      ),
    );
  } finally {
    delete SCHEDULED_KINDS.morning;
  }
});

import { exportKey, writeNightlyExport } from "./nightly-export.ts";

const fakeBucket = () => {
  const objects = new Map<string, string>();
  return {
    objects,
    head: async (k: string) => (objects.has(k) ? {} : null),
    put: async (k: string, v: string) => {
      if (objects.has(k)) return null;
      objects.set(k, v);
      return {};
    },
  };
};
const fakeExport = async () => ({
  collections: {},
  tables: { docs: { count: 3 }, sets: { count: 2 } },
});
const T0030 = Date.parse("2026-11-05T06:40:00Z"); // 00:40 Central (CST)

test("the nightly export writes once per Central date under exports/ and returns counts only", async () => {
  const IMAGES = fakeBucket();
  const env = { DB: sqliteD1() as never, IMAGES, exportAll: fakeExport };
  assert.ok(
    !(await runScheduled(env, CRON, T0030 - 20 * 60_000)).includes("export"),
  );
  assert.deepEqual(
    (await runScheduled(env, CRON, T0030)).filter((n) => n === "export"),
    ["export"],
  );
  assert.deepEqual([...IMAGES.objects.keys()], [exportKey("2026-11-05")]);
  assert.deepEqual(
    (await runScheduled(env, CRON, T0030 + 15 * 60_000)).filter(
      (n) => n === "export",
    ),
    [],
  );
});

test("the export is not run in the quiet window, and never overwrites an existing object", async () => {
  const IMAGES = fakeBucket();
  const env = { DB: sqliteD1() as never, IMAGES, exportAll: fakeExport };
  const quiet = Date.parse("2026-11-05T07:30:00Z"); // 01:30 Central
  assert.ok(!(await runScheduled(env, CRON, quiet)).includes("export"));
  IMAGES.objects.set(exportKey("2026-11-05"), "kept");
  await assert.rejects(
    writeNightlyExport(IMAGES, fakeExport, T0030),
    /not overwritten/,
  );
  assert.equal(IMAGES.objects.get(exportKey("2026-11-05")), "kept");
  const n = await writeNightlyExport(IMAGES, fakeExport, T0030 + 86_400_000);
  assert.deepEqual(n, { key: exportKey("2026-11-06"), tables: 2, rows: 5 });
});

test("with no exporter given, the export runs data's real export and stores a parseable manifest", async () => {
  const IMAGES = fakeBucket();
  const env = { DB: sqliteD1() as never, IMAGES };
  assert.ok((await runScheduled(env, CRON, T0030)).includes("export"));
  const saved = JSON.parse(IMAGES.objects.get(exportKey("2026-11-05"))!);
  assert.equal(saved.kind, "ev-d1-export");
  assert.ok(saved.tables.docs);
});
