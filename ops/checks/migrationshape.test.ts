import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { checkMigrationShape } from './migrationshape.ts';

const table = (name: string, cols: string[]): string => `CREATE TABLE IF NOT EXISTS ${name} (\n${cols.join(',\n')}\n);\n`;
const ID = "  id TEXT PRIMARY KEY CHECK (substr(id, 1, 5) = 'foo_')";
const run = (files: Record<string, string>): string[] => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-'));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  return checkMigrationShape(root, Object.keys(files)).map(f => f.detail);
};
const SHAPES = "{ table: 'foos' }\n";
const SQL = 'data/migrations/0000_baseline.sql';
const SHAPES_FILE = 'data/migrations/row-shapes.test.ts';

test('migration-shape: a table without a kind-prefixed id, at, v or deleted_at, or not in row-shapes, fails', () => {
  const good = table('foos', [ID, '  at INTEGER NOT NULL', '  v INTEGER NOT NULL', '  deleted_at INTEGER']);
  assert.deepEqual(run({ [SQL]: good, [SHAPES_FILE]: SHAPES }), []);

  const noKind = table('foos', ['  id TEXT PRIMARY KEY', '  at INTEGER NOT NULL', '  v INTEGER NOT NULL', '  deleted_at INTEGER']);
  assert.match(run({ [SQL]: noKind, [SHAPES_FILE]: SHAPES }).join('\n'), /table foos: id must be TEXT PRIMARY KEY CHECK/);

  const noAt = table('foos', [ID, '  v INTEGER NOT NULL', '  deleted_at INTEGER']);
  assert.match(run({ [SQL]: noAt, [SHAPES_FILE]: SHAPES }).join('\n'), /missing column at/);

  const noV = table('foos', [ID, '  at INTEGER NOT NULL', '  deleted_at INTEGER']);
  assert.match(run({ [SQL]: noV, [SHAPES_FILE]: SHAPES }).join('\n'), /missing column v/);

  const noDeleted = table('foos', [ID, '  at INTEGER NOT NULL', '  v INTEGER NOT NULL']);
  assert.match(run({ [SQL]: noDeleted, [SHAPES_FILE]: SHAPES }).join('\n'), /missing column deleted_at/);

  assert.match(run({ [SQL]: good, [SHAPES_FILE]: "{ table: 'bars' }\n" }).join('\n'), /not in data\/migrations\/row-shapes\.test\.ts/);
});
