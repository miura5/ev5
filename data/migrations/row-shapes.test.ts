import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  parseCollection,
  parseMembership,
  parsePin,
  parseItemProps,
  parseOwnSet,
  parseOwnSetItem,
  parseOwnAttempt,
  parseDeletion,
  parseJobPlanRow,
  parseJobRecord,
  parseCeilingUse,
  parseCeilingHold,
  parseCeilingUsage,
} from '../../domain/index.ts';

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), 'utf8');
const migrations = readdirSync(new URL('.', import.meta.url))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();
const built = (): DatabaseSync => {
  const db = new DatabaseSync(':memory:');
  for (const m of migrations) db.exec(read(m));
  return db;
};

const snake = (k: string): string => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const T = '2026-11-05T00:00:00Z';
const item = { id: 'q1', stem: 'Which finding needs action first?', options: ['a', 'b', 'c'], correct: [1] };

// table -> the domain parser that owns its row, a valid sample row, and how the keys land in columns (§data.tables:
// `at` and `v` on every table under §data.protocol). The shape's keys are read from the parser's output (every shape is
// a strict object), and a key is required when the parser refuses it as null. `expand` splits a key into several
// columns; `stored` keys live inside a JSON column, so that row has `data` instead.
// Gaps: `drafts` has no entry (parseDraft is not in the domain barrel yet), and exam, objective, weak spot, set,
// session and note have no row shape for a table of their own yet; they stay in `docs` for now.
type Entry = {
  table: string;
  parse: (r: unknown) => object;
  sample: Record<string, unknown>;
  expand?: Record<string, string[]>;
  stored?: string[];
};
const tables: Entry[] = [
  { table: 'collections', parse: parseCollection, sample: { id: 'c1', title: 't', parentId: null, pos: 0, at: T, v: 1 } },
  { table: 'memberships', parse: parseMembership, sample: { itemC: 'notes', itemId: 'n1', collectionId: 'c1', at: T, v: 1 } },
  { table: 'pins', parse: parsePin, sample: { targetC: 'notes', targetId: 'n1', pos: 0, at: T } },
  {
    table: 'item_props',
    parse: parseItemProps,
    sample: { c: 'notes', id: 'n1', time: null, repeat: null, linked: null, overrides: null, at: T, v: 1 },
    expand: { linked: ['linked_c', 'linked_id'] },
  },
  {
    table: 'own_sets',
    parse: parseOwnSet,
    sample: { id: 's1', title: 't', type: 'question', sourceC: null, sourceId: null, at: T, v: 1 },
  },
  { table: 'own_set_items', parse: parseOwnSetItem, sample: { setId: 's1', itemId: 'q1', pos: 0, body: item, at: T, v: 1 } },
  { table: 'own_attempts', parse: parseOwnAttempt, sample: { setId: 's1', itemId: 'q1', key: 'k', at: T, body: { chosen: [0] } } },
  { table: 'deletions', parse: parseDeletion, sample: { c: 'notes', id: 'n1', at: T } },
  { table: 'job_plans', parse: parseJobPlanRow, sample: { jobId: 'j', kind: 'plan', body: {}, at: T } },
  { table: 'ceiling_use', parse: parseCeilingUse, sample: { w: 'day', k: 'k', used: 0 } },
  { table: 'ceiling_holds', parse: parseCeilingHold, sample: { id: 'h', amount: 0, limits: [], open: true } },
  { table: 'ceiling_usage', parse: parseCeilingUsage, sample: { key: 'k', holdId: 'h' } },
  // A job record keeps its fields as one JSON document in `data`; only id and v (and the row's `at`) are columns.
  {
    table: 'job_records',
    parse: parseJobRecord,
    sample: { id: 'j', kind: 'k', title: 't', state: 'queued', costCents: 0, createdAt: T, updatedAt: T, v: 1 },
    stored: ['kind', 'title', 'state', 'reason', 'step', 'costCents', 'output', 'createdAt', 'updatedAt', 'needsYouAt'],
  },
];

test('every v5 table matches its domain row shape (PRAGMA table_info)', () => {
  const db = built();
  for (const { table, parse, sample, expand = {}, stored = [] } of tables) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; notnull: number; pk: number }[];
    const keys = Object.keys(parse(sample)).filter((k) => !stored.includes(k));
    const want = keys.flatMap((k) => expand[k] ?? [snake(k)]);
    if (stored.length) want.push('data', 'at');
    assert.deepEqual(cols.map((c) => c.name).sort(), [...new Set(want)].sort(), table);
    for (const k of keys) {
      let required = false;
      try {
        parse({ ...sample, [k]: null });
      } catch {
        required = true;
      }
      for (const name of expand[k] ?? [snake(k)]) {
        const col = cols.find((c) => c.name === name);
        if (required) assert.ok(col && (col.notnull === 1 || col.pk > 0), `${table}.${name} is required`);
      }
    }
  }
});

test('every pointer column is indexed (§data.tables)', () => {
  const db = built();
  const indexed = (table: string): string[] =>
    (db.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[]).map((i) =>
      (db.prepare(`PRAGMA index_info(${i.name})`).all() as { name: string }[]).map((c) => c.name).join(','),
    );
  const pointers: Record<string, string[]> = {
    collections: ['parent_id'],
    memberships: ['collection_id'],
    own_sets: ['source_c,source_id'],
    item_props: ['linked_c,linked_id'],
    drafts: ['job_id', 'target_c,target_id'],
    own_set_items: ['set_id,item_id'],
    own_attempts: ['set_id,item_id,key,at'],
    job_plans: ['job_id,kind'],
    ceiling_usage: ['hold_id'],
  };
  for (const [table, list] of Object.entries(pointers)) {
    for (const p of list) assert.ok(indexed(table).some((i) => i === p || i.startsWith(`${p},`)), `${table}(${p})`);
  }
});

test('ADD COLUMN works on a built database (§data.additive)', () => {
  const db = built();
  db.exec('ALTER TABLE pins ADD COLUMN note TEXT');
  assert.ok((db.prepare('PRAGMA table_info(pins)').all() as { name: string }[]).some((c) => c.name === 'note'));
});
