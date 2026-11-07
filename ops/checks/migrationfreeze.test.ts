import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { BASELINE, checkMigrationFreeze, hashBaseline } from './migrationfreeze.ts';

const tmp = (text?: string): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'freeze-'));
  if (text !== undefined) {
    fs.mkdirSync(path.join(root, 'data/migrations'), { recursive: true });
    fs.writeFileSync(path.join(root, BASELINE), text);
  }
  return root;
};

test('migration-freeze: the real baseline matches the pin', () => {
  const root = new URL('../..', import.meta.url).pathname;
  assert.deepEqual(checkMigrationFreeze(root, [BASELINE]), []);
});

test('migration-freeze: an edited baseline fails (red fixture), the same text with CRLF does not', () => {
  const sql = 'CREATE TABLE IF NOT EXISTS a (id TEXT);\n';
  const pin = hashBaseline(sql);
  assert.deepEqual(checkMigrationFreeze(tmp(sql), [BASELINE], pin), []);
  assert.deepEqual(checkMigrationFreeze(tmp(sql.replace(/\n/g, '\r\n')), [BASELINE], pin), []);
  const red = checkMigrationFreeze(tmp(sql + 'ALTER TABLE a ADD COLUMN b TEXT;\n'), [BASELINE], pin);
  assert.equal(red.length, 1);
  assert.match(red[0]?.detail ?? '', /frozen.*new numbered migration.*PIN/);
});

test('migration-freeze: a missing baseline fails', () => {
  assert.match(checkMigrationFreeze(tmp(), ['data/migrations/0001_x.sql'], 'x')[0]?.detail ?? '', /missing/);
});
