import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

type Row = { name: string; type: string; col: string };
type Verify = {
  missingFromStaging: (sql: string, rows: Row[]) => { missingCols: string[] };
  wantedColumns: (sql: string) => Map<string, string[]>;
  rowsFrom: (json: string) => Row[];
};
const modulePath = '../verify-staging-schema.mjs';
const { missingFromStaging, wantedColumns, rowsFrom } = (await import(modulePath)) as Verify;

const baseline = fs.readFileSync(new URL('../../data/migrations/0000_baseline.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');

test('verify-staging-schema: reads columns from the real baseline, including a column added late', () => {
  const cols = wantedColumns(baseline);
  assert.ok(cols.get('drafts')?.includes('target_kind'));
  assert.ok(!cols.get('job_plans')?.includes('PRIMARY'));
  // Quoted names come back from pragma_table_info without quotes (staging run 819 would have reported links."by").
  assert.ok(cols.get('links')?.includes('by'));
  assert.ok(cols.get('weak_spot_events')?.includes('until'));
  assert.ok(![...cols.values()].flat().some((c) => /["`[\]]/.test(c)));
});

test('verify-staging-schema: a quoted column added by ALTER TABLE is matched without its quotes', () => {
  const sql = 'CREATE TABLE IF NOT EXISTS a (\n "by" TEXT\n);\nALTER TABLE a ADD COLUMN "until" TEXT;\n';
  assert.deepEqual(wantedColumns(sql).get('a'), ['by', 'until']);
});

test('verify-staging-schema: a failed wrangler query is reported with its error, not a TypeError', () => {
  const ok = JSON.stringify([{ results: [{ name: 'a', type: 'table', col: '' }], success: true }]);
  assert.deepEqual(rowsFrom(ok), [{ name: 'a', type: 'table', col: '' }]);
  const failed = JSON.stringify({ error: { text: 'not authorized: SQLITE_AUTH' } });
  assert.throws(() => rowsFrom(failed), /wrangler d1 execute failed: .*SQLITE_AUTH/);
});

test('verify-staging-schema: a table that lacks one column is reported (red fixture)', () => {
  const sql = 'CREATE TABLE IF NOT EXISTS a (\n id TEXT PRIMARY KEY,\n b INTEGER NOT NULL\n);\nALTER TABLE a ADD COLUMN c TEXT;\n';
  const rows = [
    { name: 'a', type: 'table', col: '' },
    { name: 'a', type: 'column', col: 'id' },
    { name: 'a', type: 'column', col: 'b' },
  ];
  assert.deepEqual(missingFromStaging(sql, rows).missingCols, ['a.c']);
  assert.deepEqual(missingFromStaging(sql, [...rows, { name: 'a', type: 'column', col: 'c' }]).missingCols, []);
});
