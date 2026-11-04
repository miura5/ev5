import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Statement } from "../docs/d1.ts";
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
// Test-only DDL for the §5.10 tables, whose migrations are not on main yet.
const NEW_DDL = `
CREATE TABLE collections (id TEXT PRIMARY KEY, title TEXT, parent_id TEXT, pos INTEGER, at INTEGER, v INTEGER);
CREATE TABLE memberships (item_c TEXT, item_id TEXT, collection_id TEXT, at INTEGER, v INTEGER, PRIMARY KEY (item_c, item_id));
CREATE TABLE pins (target_c TEXT, target_id TEXT, pos INTEGER, at INTEGER, PRIMARY KEY (target_c, target_id));
CREATE TABLE views (id TEXT PRIMARY KEY, title TEXT, query TEXT, at INTEGER, v INTEGER);
CREATE TABLE item_props (c TEXT, id TEXT, time TEXT, repeat TEXT, linked_c TEXT, linked_id TEXT, overrides TEXT, at INTEGER, v INTEGER, PRIMARY KEY (c, id));
CREATE TABLE own_sets (id TEXT PRIMARY KEY, title TEXT, type TEXT, source_c TEXT, source_id TEXT, at INTEGER, v INTEGER);
CREATE TABLE own_attempts (set_id TEXT, item_id TEXT, key TEXT, at INTEGER, body TEXT, PRIMARY KEY (set_id, item_id, key, at));`;

function migrated(withNew: boolean): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(sql("0000_baseline.sql"));
  db.exec(sql("0001_deletions.sql"));
  db.exec(sql("0002_jobs_ceilings.sql")); // job tables, drafts and own_set_items
  if (withNew) db.exec(NEW_DDL);
  return db;
}

const SEED = `
INSERT INTO docs VALUES ('notes','n1','{"a":1}',10,2),('notes','n2','{"b":"é"}',11,1),('exams','e1','{}',12,1),
 ('system','worker','{"token":"x"}',13,1),('system','other','{}',14,1);
INSERT INTO deletions VALUES ('notes','gone',20);
INSERT INTO claude_usage VALUES (100,'2026-11-03',50,2);
INSERT INTO claude_reads VALUES ('n1','h1',30);
INSERT INTO claude_settings VALUES ('claude.hourTokens',1000,31);
INSERT INTO claude_plan_asks VALUES ('job1',2,32);
INSERT INTO system_docs VALUES ('manifest','{}',33),('keepme','{}',34);
INSERT INTO collections VALUES ('k1','Unit',NULL,0,40,1),('k2','Sub','k1',1,41,1);
INSERT INTO memberships VALUES ('notes','n1','k2',42,1);
INSERT INTO pins VALUES ('notes','n1',0,43);
INSERT INTO views VALUES ('v1','Due','{"q":1}',44,1);
INSERT INTO item_props VALUES ('dayedits','d1','09:00','{"every":"day"}','notes','n1','{}',45,1);
INSERT INTO own_sets VALUES ('s1','Mine','question',NULL,NULL,46,1);
INSERT INTO own_set_items VALUES ('s1','i1',0,'{"q":"?"}',47,1),('s1','i2',1,'{"q":"!"}',47,1);
INSERT INTO own_attempts VALUES ('s1','i1','a',48,'{"ok":true}'),('s1','i1','a',49,'{"ok":false}');
INSERT INTO drafts VALUES ('dr1','j1','plan','dayedits','d2','{}','pending',50,1);
INSERT INTO job_records VALUES ('j1','{"state":"done"}',60,1);
INSERT INTO ceiling_use VALUES ('2026-11-03','tokens',500),('2026-11-03','calls',3);
INSERT INTO ceiling_holds VALUES ('h1',100,'{"day":1}',1);
INSERT INTO job_plans VALUES ('j1','plan','{"steps":[]}',61);`;

test("export then restore into scratch: every table count and hash equal", async () => {
  const src = migrated(true);
  src.exec(SEED);
  const x = await exportAll(sqliteD1(src), Date.UTC(2026, 10, 3));
  assert.deepEqual(await checkExport(x), []);
  assert.equal(x.tables.docs!.count, 4); // the system "worker" document is left out (D-321)
  assert.equal(x.tables.system_docs!.count, 1);
  assert.deepEqual(Object.keys(x.collections), ["exams", "notes", "system"]);
  for (const t of ALL_TABLES) assert.ok(x.tables[t.name], t.name);
  assert.equal(x.tables.own_attempts!.count, 2);
  for (const n of ["job_records", "ceiling_holds", "job_plans"])
    assert.equal(x.tables[n]!.count, 1, n);
  assert.equal(x.tables.ceiling_use!.count, 2);
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
  src.exec("INSERT INTO docs VALUES ('notes','n1','{}',1,1)");
  const x = await exportAll(sqliteD1(src));
  assert.equal(x.tables.collections!.count, 0);
  const report = await restoreInto(sqliteD1(migrated(false)), x);
  assert.equal(report.ok, true);
});

test("orphans are reported and kept; a grandparent collection fails the restore", async () => {
  const src = migrated(true);
  src.exec(`INSERT INTO collections VALUES ('a','A',NULL,0,1,1),('b','B','a',0,1,1),('c','C','b',0,1,1);
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
  x.rows.docs![0]!.data = '{"changed":true}';
  const scratch = migrated(true);
  const report = await restoreInto(sqliteD1(scratch), x);
  assert.equal(report.ok, false);
  assert.ok(report.diffs.length > 0);
  assert.equal(
    (scratch.prepare("SELECT count(*) AS n FROM docs").get() as { n: number })
      .n,
    0,
  );
});

test("the export covers every non-virtual table the migrations create", () => {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  assert.ok(files.length >= 3);
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
});
