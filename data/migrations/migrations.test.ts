import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8');
const ev4 = read('ev4-schema.fixture.sql'); // frozen copy of ev4's pwa/schema.sql
const migrations = readdirSync(new URL('.', import.meta.url))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

const shape = (db: DatabaseSync): string =>
  JSON.stringify(db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all());

test('migrations are numbered in order from the baseline', () => {
  assert.equal(migrations[0], '0000_baseline.sql');
  migrations.forEach((m, i) => assert.equal(Number(m.slice(0, 4)), i, m));
});

test('the baseline is a no-op on ev4 schema: same objects, same rows', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(ev4);
  db.exec("INSERT INTO docs (c, id, data, at, v) VALUES ('notes', 'n1', '{}', 1, 3)");
  const before = shape(db);
  db.exec(read('0000_baseline.sql'));
  assert.equal(shape(db), before);
  assert.equal(JSON.stringify(db.prepare('SELECT c, id, v FROM docs').all()), '[{"c":"notes","id":"n1","v":3}]');
});

test('the baseline alone builds the same schema as ev4', () => {
  const a = new DatabaseSync(':memory:');
  a.exec(ev4);
  const b = new DatabaseSync(':memory:');
  b.exec(read('0000_baseline.sql'));
  assert.equal(shape(b), shape(a));
});

test('every migration is idempotent and only adds', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(ev4);
  const base = JSON.parse(shape(db)) as { name: string; sql: string }[];
  for (const m of migrations) db.exec(read(m));
  const once = shape(db);
  for (const m of migrations) db.exec(read(m));
  assert.equal(shape(db), once);
  const after = JSON.parse(once) as { name: string; sql: string }[];
  for (const o of base) assert.equal(after.find((x) => x.name === o.name)?.sql, o.sql);
  for (const m of migrations) assert.doesNotMatch(read(m).replace(/--.*$/gm, ''), /\b(DROP|DELETE|UPDATE)\b/i, m);
  // §data.additive: adding a column is an ordinary migration; every other ALTER form (rename, drop) stays banned.
  for (const m of migrations) {
    const sql = read(m).replace(/--.*$/gm, '').replace(/\bALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN\b/gi, '');
    assert.doesNotMatch(sql, /\bALTER\b/i, m);
  }
});

test('deletions soft-deletes: a row is added, no document is removed', () => {
  const db = new DatabaseSync(':memory:');
  for (const m of migrations) db.exec(read(m));
  db.exec("INSERT INTO docs (c, id, data, at, v) VALUES ('notes', 'n1', '{}', 1, 1)");
  db.exec("INSERT INTO deletions (c, id, at) VALUES ('notes', 'n1', 2)");
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM docs').get()?.n, 1);
  assert.throws(() => db.exec("INSERT INTO deletions (c, id, at) VALUES ('notes', 'n1', 3)"));
});

test('staging schema is the baseline plus the migrations', () => {
  assert.equal(read('../staging/schema.sql'), migrations.map(read).join('\n'));
});
