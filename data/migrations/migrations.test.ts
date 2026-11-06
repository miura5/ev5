import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8');
const migrations = readdirSync(new URL('.', import.meta.url))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

const shape = (db: DatabaseSync): string =>
  JSON.stringify(db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all());

test('migrations are numbered in order from the baseline', () => {
  assert.equal(migrations[0], '0000_baseline.sql');
  migrations.forEach((m, i) => assert.equal(Number(m.slice(0, 4)), i, m));
});

test('the migrations apply cleanly, in order, to an empty database', () => {
  const db = new DatabaseSync(':memory:');
  for (const m of migrations) assert.doesNotThrow(() => db.exec(read(m)), m);
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name);
  for (const t of ['docs', 'deletions', 'job_records', 'collections']) assert.ok(tables.includes(t), t);
});

test('every migration is idempotent and only adds', () => {
  const db = new DatabaseSync(':memory:');
  let before = JSON.parse(shape(db)) as { name: string; sql: string }[];
  for (const m of migrations) {
    db.exec(read(m));
    const after = JSON.parse(shape(db)) as { name: string; sql: string }[];
    // An ADD COLUMN appends to the table's stored SQL; everything before the appended columns must be untouched.
    const base = (sql: string): string => sql.replace(/(,\s*\w+ [A-Z]+[^,)]*)*\)$/, '');
    for (const o of before) {
      const now = after.find((x) => x.name === o.name)?.sql ?? '';
      // SQLite puts the new column before a trailing table constraint (PRIMARY KEY (...)), so every old line must survive, in order.
      const kept = (): boolean => {
        let at = 0;
        for (const line of o.sql.split('\n').map((l) => l.trim().replace(/,$/, '')).filter(Boolean)) {
          const i = now.indexOf(line, at);
          if (i < 0) return false;
          at = i + line.length;
        }
        return true;
      };
      assert.ok(now === o.sql || now.startsWith(base(o.sql)) || kept(), `${m} changed ${o.name}`);
    }
    before = after;
  }
  const once = shape(db);
  // D1 applies each migration once, so an ADD COLUMN (no IF NOT EXISTS in SQLite) is not re-run; the rest must be.
  for (const m of migrations) if (!/\bADD\s+COLUMN\b/i.test(read(m))) db.exec(read(m));
  assert.equal(shape(db), once);
  // Only a `*_backfill` migration rewrites rows (UPDATE); nothing is ever dropped or deleted.
  for (const m of migrations) assert.doesNotMatch(read(m).replace(/--.*$/gm, ''), /\b(DROP|DELETE)\b/i, m);
  for (const m of migrations.filter((f) => !/_backfill\.sql$/.test(f))) assert.doesNotMatch(read(m).replace(/--.*$/gm, ''), /\bUPDATE\b/i, m);
  // §data.additive: adding a column is an ordinary migration; every other ALTER form (rename, drop) stays banned.
  for (const m of migrations) {
    const sql = read(m).replace(/--.*$/gm, '').replace(/\bALTER\s+TABLE\s+\w+\s+ADD\s+COLUMN\b/gi, '');
    assert.doesNotMatch(sql, /\bALTER\b/i, m);
  }
});

test('every LIKE or GLOB pattern fits D1 (50 bytes at most)', () => {
  // D1 refuses a longer pattern ("LIKE or GLOB pattern too complex"); local SQLite allows it, so the apply test above cannot catch it.
  for (const f of migrations) {
    const sql = read(f).replace(/--.*$/gm, '');
    for (const [, p] of sql.matchAll(/\b(?:LIKE|GLOB)\s+'((?:[^']|'')*)'/gi)) {
      assert.ok(Buffer.byteLength(p.replace(/''/g, "'")) <= 50, `${f}: pattern of ${Buffer.byteLength(p)} bytes: ${p}`);
    }
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
