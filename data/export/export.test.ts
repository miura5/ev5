import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Statement } from "../d1.ts";
import { exportAll, restoreInto, checkExport, ALL_TABLES } from "./index.ts";

// A D1 stand-in over node:sqlite (real SQL, so the export's SELECTs and the restore's INSERTs are exercised).
function sqliteD1(db: DatabaseSync): D1Like {
  const prepare = (sql: string): D1Statement => {
    let args: (string | number | null)[] = [];
    const st: D1Statement = {
      bind: (...v) => ((args = v), st),
      first: async <T>() => (db.prepare(sql).get(...args) ?? null) as T | null,
      all: async <T>() => ({ results: db.prepare(sql).all(...args) as T[] }),
      run: async () => ({
        meta: { changes: Number(db.prepare(sql).run(...args).changes) },
      }),
    };
    return st;
  };
  return {
    prepare,
    async batch(sts) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of sts) out.push(await s.run());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

const sql = (f: string) =>
  readFileSync(new URL(`../migrations/${f}`, import.meta.url), "utf8");
function migrated(withNew: boolean): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(sql("0000_baseline.sql"));
  // Without the newer tables: a table that is not there exports as empty and restores as nothing.
  if (!withNew) db.exec("DROP TABLE collections; DROP TABLE files; DROP TABLE memberships");
  return db;
}

const SEED = `
INSERT INTO settings (key, value, at, v) VALUES ('ceiling_daily',1000,31,1);
INSERT INTO collections (id, title, parent_id, pos, at, v) VALUES ('k1','Unit',NULL,0,40,1),('k2','Sub','k1',1,41,1);
INSERT INTO memberships VALUES ('sets','set_1','k2',42,1);
INSERT INTO pins (target_c, target_id, pos, at) VALUES ('notes','n1',0,43);
INSERT INTO item_props VALUES ('notes','d1','09:00','{"every":"day"}','notes','n1','{}',45,1);
INSERT INTO sets (id, kind, title, created_by, at, v) VALUES ('set_1','own','Mine','matt',46,1);
INSERT INTO set_items (id, set_id, pos, type, body, at, v) VALUES ('item_1','set_1',0,'question','{"q":"?"}',47,1),('item_2','set_1',1,'question','{"q":"!"}',47,1);
INSERT INTO drafts (id, job_id, kind, target_c, target_id, body, state, at, v, target_kind) VALUES ('dr1','j1','plan','sets','d2','{}','pending',50,1,'sets');
INSERT INTO plans (id, goal_id, state, from_day, to_day, at) VALUES ('plan_1','goal_1','in_force','2026-11-05','2026-11-12',51);
INSERT INTO repeats (id, title, rule, from_day, at) VALUES ('rep_1','Flashcards','{"every":"day"}','2026-11-05',52);
INSERT INTO plan_items (id, plan_id, day, pos, title, origin, repeat_id, at) VALUES ('pli_1','plan_1','2026-11-05',0,'Read','plan',NULL,53),('pli_2',NULL,'2026-11-05',1,'Cards','morning','rep_1',54);
INSERT INTO job_records VALUES ('j1','{"state":"done"}',60,1);
INSERT INTO ceiling_use VALUES ('2026-11-03','tokens',500),('2026-11-03','calls',3);
INSERT INTO ceiling_holds VALUES ('h1',100,'{"day":1}',1);
INSERT INTO ceiling_usage VALUES ('j1:a:1','h1');
INSERT INTO job_plans VALUES ('j1','plan','{"steps":[]}',61);`;

test("export then restore into scratch: every table count and hash equal", async () => {
  const src = migrated(true);
  src.exec(SEED);
  const x = await exportAll(sqliteD1(src), Date.UTC(2026, 10, 3));
  assert.deepEqual(await checkExport(x), []);
  assert.equal(x.kind, "ev5-export");
  assert.equal(x.tables.docs, undefined); // there is no generic docs table
  for (const t of ALL_TABLES) assert.ok(x.tables[t.name], t.name);
  assert.equal(x.tables.set_items!.count, 2);
  for (const n of ["job_records", "ceiling_holds", "job_plans"])
    assert.equal(x.tables[n]!.count, 1, n);
  assert.equal(x.tables.ceiling_use!.count, 2);
  assert.equal(x.tables.plans!.count, 1);
  assert.equal(x.tables.plan_items!.count, 2);
  assert.equal(x.tables.repeats!.count, 1);
  assert.match(x.tables.job_plans!.sha256, /^[0-9a-f]{64}$/);

  const scratch = migrated(true);
  const report = await restoreInto(
    sqliteD1(scratch),
    JSON.parse(JSON.stringify(x)),
  );
  assert.deepEqual(report, { ok: true, diffs: [], orphans: [], problems: [] });
  for (const t of ALL_TABLES) {
    const n = (d: DatabaseSync) =>
      (d.prepare(`SELECT count(*) AS n FROM ${t.name}`).get() as { n: number })
        .n;
    assert.equal(n(scratch), x.tables[t.name]!.count, t.name);
  }
});

test("a table whose migration has not landed exports as empty; restoring into a scratch without them works", async () => {
  const src = migrated(false);
  const x = await exportAll(sqliteD1(src));
  assert.equal(x.tables.collections!.count, 0);
  const report = await restoreInto(sqliteD1(migrated(false)), x);
  assert.equal(report.ok, true);
});

test("a set item whose set is missing from the sets table is an orphan", async () => {
  const src = migrated(true);
  src.exec(`INSERT INTO set_items (id, set_id, pos, type, body, at, v) VALUES ('item_9','set_gone',0,'question','{}',1,1);`);
  const report = await restoreInto(
    sqliteD1(migrated(true)),
    await exportAll(sqliteD1(src)),
  );
  assert.deepEqual(report.orphans, [
    "set_item set_gone/item_9: set missing",
  ]);
});

test("orphans are reported and kept; a grandparent collection fails the restore", async () => {
  const src = migrated(true);
  src.exec(`INSERT INTO collections (id, title, parent_id, pos, at, v) VALUES ('a','A',NULL,0,1,1),('b','B','a',0,1,1),('c','C','b',0,1,1);
    INSERT INTO memberships VALUES ('notes','missing','a',1,1);`);
  const scratch = migrated(true);
  const report = await restoreInto(
    sqliteD1(scratch),
    await exportAll(sqliteD1(src)),
  );
  assert.equal(report.ok, false);
  assert.deepEqual(report.problems, ["collection c: has a grandparent"]);
  assert.deepEqual(report.orphans, ["membership notes/missing: item missing"]);
  assert.equal(
    (
      scratch.prepare("SELECT count(*) AS n FROM memberships").get() as {
        n: number;
      }
    ).n,
    1,
  );
});

test("a tampered export is refused before anything is written", async () => {
  const src = migrated(true);
  src.exec(SEED);
  const x = await exportAll(sqliteD1(src));
  x.rows.job_plans![0]!.body = '{"changed":true}';
  const scratch = migrated(true);
  const report = await restoreInto(sqliteD1(scratch), x);
  assert.equal(report.ok, false);
  assert.ok(report.diffs.length > 0);
  assert.equal(
    (scratch.prepare("SELECT count(*) AS n FROM job_plans").get() as { n: number })
      .n,
    0,
  );
});

test("a restore refuses a file of any other kind, an ev4 backup included, and writes nothing", async () => {
  const src = migrated(true);
  src.exec(SEED);
  const x = await exportAll(sqliteD1(src));
  for (const kind of ["ev-d1-export", "other"]) {
    const scratch = migrated(true);
    const report = await restoreInto(sqliteD1(scratch), {
      ...x,
      kind,
    } as never);
    assert.equal(report.ok, false, kind);
    assert.match(report.diffs[0] ?? "", /only v5's own export is restored/);
    assert.equal(
      (scratch.prepare("SELECT count(*) AS n FROM job_plans").get() as { n: number })
        .n,
      0,
    );
  }
});

test("the export covers every non-virtual table the migrations create, and lists no table they do not", () => {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  assert.ok(files.length >= 1);
  for (const f of files) db.exec(sql(f));
  const rows = db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'",
    )
    .all() as { name: string; sql: string }[];
  const real = rows
    .filter((r) => !/^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(r.sql))
    .map((r) => r.name);
  assert.ok(real.includes("job_plans"));
  const covered = new Set(ALL_TABLES.map((t) => t.name));
  assert.deepEqual(
    real.filter((n) => !covered.has(n)),
    [],
    "tables missing from data/export/tables.ts",
  );
  assert.deepEqual(
    [...covered].filter((n) => !real.includes(n)),
    [],
    "tables listed in data/export/tables.ts that no migration creates",
  );
});
