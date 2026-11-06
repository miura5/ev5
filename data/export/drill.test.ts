// Restore drills (§data.export, §data.tables): for every table in the export manifest, export it, restore it
// into a scratch D1 and prove the counts, hashes and canonical rows match. Local and synthetic only; no live data.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { exportAll, restoreInto, ALL_TABLES } from "./index.ts";
import type { Row } from "./index.ts";
import type { TableSpec } from "./tables.ts";
import { migratedDb, sqliteD1 } from "./sqlite-d1.testkit.ts";

const JSON_COLS = ["data", "body", "query", "overrides", "limits"];
const NULL_COLS = [
  "parent_id",
  "source_c",
  "source_id",
  "linked_c",
  "linked_id",
];
const ROWS_PER_TABLE = 3;

/** Canonical JSON: keys sorted at every depth, so two equal rows always print the same bytes. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(v);
}

/** Synthetic rows for one table, typed from the migrated schema; JSON columns get unicode and nesting. */
function seed(db: DatabaseSync, spec: TableSpec): boolean {
  const info = db.prepare(`PRAGMA table_info(${spec.name})`).all() as {
    name: string;
    type: string;
  }[];
  if (!info.length) return false; // a table no migration creates exports as empty
  const types = new Map(info.map((c) => [c.name, c.type.toUpperCase()]));
  // A table whose id carries a kind prefix as a CHECK (§data.tables) gets ids that satisfy it.
  const ddl = (
    db
      .prepare("SELECT sql FROM sqlite_master WHERE name = ?")
      .get(spec.name) as { sql: string }
  ).sql;
  const prefix = /substr\(id, 1, \d+\) = '(\w+)'/.exec(ddl)?.[1] ?? "";
  for (let n = 1; n <= ROWS_PER_TABLE; n++) {
    const vals = spec.columns.map((c) => {
      if (NULL_COLS.includes(c)) return null;
      if (JSON_COLS.includes(c))
        return `{"z":${n},"a":{"é":"ü ${n}","list":[1,"two",null]}}`;
      if (c === "id" && prefix) return `${prefix}${n}`;
      if (c === "c" && spec.name === "docs") return n === 1 ? "notes" : "exams";
      return types.get(c) === "INTEGER" ? n : `${spec.name}-${c}-${n}`;
    });
    db.prepare(
      `INSERT INTO ${spec.name} (${spec.columns.join(",")}) VALUES (${vals.map(() => "?").join(",")})`,
    ).run(...vals);
  }
  return true;
}

const countOf = (db: DatabaseSync, table: string): number =>
  (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

for (const spec of ALL_TABLES) {
  test(`drill: ${spec.name} exports and restores into a scratch D1 with equal counts, hashes and canonical rows`, async () => {
    const src = migratedDb();
    const want = seed(src, spec) ? ROWS_PER_TABLE : 0;
    const x = await exportAll(sqliteD1(src), Date.UTC(2026, 10, 5));
    assert.equal(x.tables[spec.name]!.count, want);
    for (const other of ALL_TABLES)
      if (other.name !== spec.name)
        assert.equal(
          x.tables[other.name]!.count,
          0,
          `${other.name} stays empty`,
        );

    const scratch = migratedDb();
    const wire = JSON.parse(JSON.stringify(x)); // as it would travel through R2
    const report = await restoreInto(sqliteD1(scratch), wire);
    assert.deepEqual(report.diffs, []);
    assert.deepEqual(report.problems, []);
    assert.equal(report.ok, true);
    if (want) assert.equal(countOf(scratch, spec.name), want);

    const back = await exportAll(sqliteD1(scratch), Date.UTC(2026, 10, 5));
    assert.deepEqual(back.tables, x.tables);
    assert.deepEqual(back.collections, x.collections);
    assert.equal(
      canon(back.rows),
      canon(x.rows),
      "canonical rows differ after restore",
    );
  });
}

test("drill: one record holding every table restores as written, collection by collection", async () => {
  const src = migratedDb();
  for (const spec of ALL_TABLES) seed(src, spec);
  const x = await exportAll(sqliteD1(src));
  for (const spec of ALL_TABLES)
    assert.ok(x.tables[spec.name]!.count > 0, spec.name);

  const scratch = migratedDb();
  const report = await restoreInto(
    sqliteD1(scratch),
    JSON.parse(JSON.stringify(x)),
  );
  assert.equal(report.ok, true);
  const back = await exportAll(sqliteD1(scratch));
  assert.deepEqual(back.collections, x.collections);
  assert.equal(canon(back.rows), canon(x.rows));
  assert.equal(canon(back.docs), canon(x.docs));
});

test("drill: restoring into a scratch that already holds rows is refused by the keys, never merged", async () => {
  const src = migratedDb();
  seed(src, ALL_TABLES[0]!);
  const x = await exportAll(sqliteD1(src));
  const scratch = migratedDb();
  await restoreInto(sqliteD1(scratch), x);
  await assert.rejects(restoreInto(sqliteD1(scratch), x));
  assert.equal(countOf(scratch, "docs"), ROWS_PER_TABLE);
});

test("drill: a row changed in any table is caught by that table's hash before a restore", async () => {
  for (const spec of ALL_TABLES) {
    const src = migratedDb();
    if (!seed(src, spec)) continue;
    const x = await exportAll(sqliteD1(src));
    const row: Row = x.rows[spec.name]![0]!;
    const col = spec.columns[spec.columns.length - 1]!;
    row[col] =
      typeof row[col] === "number" ? Number(row[col]) + 1 : `${row[col]}!`;
    const scratch = migratedDb();
    const report = await restoreInto(sqliteD1(scratch), x);
    assert.equal(report.ok, false, spec.name);
    assert.ok(
      report.diffs.some((d) => d.startsWith(`${spec.name}:`)),
      spec.name,
    );
    assert.equal(countOf(scratch, spec.name), 0, `${spec.name} untouched`);
  }
});

test("drill: each table's listed columns and key order are the migrated schema's, so no column is left out of a hash", () => {
  const db = migratedDb();
  for (const spec of ALL_TABLES) {
    const info = db.prepare(`PRAGMA table_info(${spec.name})`).all() as {
      name: string;
      pk: number;
    }[];
    assert.ok(info.length, `${spec.name}: no migration creates it`);
    assert.deepEqual(
      [...info.map((c) => c.name)].sort(),
      [...spec.columns].sort(),
      `${spec.name} columns`,
    );
    assert.deepEqual(
      info
        .filter((c) => c.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((c) => c.name),
      spec.orderBy,
      `${spec.name} key order`,
    );
  }
});
