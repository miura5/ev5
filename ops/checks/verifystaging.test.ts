import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'vitest';

type Row = { name: string; type: string; col: string };
type Verify = {
  missingFromStaging: (sql: string, rows: Row[]) => { missingCols: string[] };
  wantedColumns: (sql: string) => Map<string, string[]>;
};
const modulePath = '../verify-staging-schema.mjs';
const { missingFromStaging, wantedColumns } = (await import(modulePath)) as Verify;

const baseline = fs.readFileSync(new URL('../../data/migrations/0000_baseline.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');

test('verify-staging-schema: reads columns from the real baseline, including a column added late', () => {
  const cols = wantedColumns(baseline);
  assert.ok(cols.get('drafts')?.includes('target_kind'));
  assert.ok(!cols.get('job_plans')?.includes('PRIMARY'));
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
