import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  parseCollectionRow,
  parseGoalRow,
  parseObjectiveTableRow,
  parseLinkRow,
  parseNoteTableRow,
  parseSetTableRow,
  parseSetItemRow,
  parseSetItemVersionRow,
  parseWeakSpotTableRow,
  parseWeakSpotEventRow,
  parseAttemptRow,
  parseSessionTableRow,
  parseSessionEventRow,
  parseTalkRow,
  parseFileRow,
  parsePlanTableRow,
  parsePlanItemTableRow,
  parseRepeatRow,
  parseMembership,
  parsePinTableRow,
  parseItemProps,
  parseOwnSet,
  parseOwnSetItem,
  parseOwnAttempt,
  parseDeletion,
  parseDraftTableRow,
  parseJobPlanRow,
  parseJobRecord,
  parseCeilingUse,
  parseCeilingHold,
  parseCeilingUsage,
  parseSettingRow,
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
const S = { at: 1, v: 1 };
const D = { deleted_at: null };
const item = { id: 'q1', stem: 'Which finding needs action first?', options: ['a', 'b', 'c'], correct: [1] };

// table -> the domain parser that owns its row, a valid sample row, and how the keys land in columns (§data.tables:
// `at` and `v` on every table under §data.protocol). The shape's keys are read from the parser's output (every shape is
// a strict object), and a key is required when the parser refuses it as null. `expand` splits a key into several
// columns; `stored` keys live inside a JSON column, so that row has `data` instead.
// `extra` names columns the table has beyond the parser's keys (drafts keeps `target_c` beside the new `target_kind`).
// The old docs-backed tables stay until the contract migration.
type Entry = {
  table: string;
  parse: (r: unknown) => object;
  sample: Record<string, unknown>;
  expand?: Record<string, string[]>;
  stored?: string[];
  extra?: string[];
};
const tables: Entry[] = [
  { table: 'collections', parse: parseCollectionRow, sample: { id: 'col_1', title: 't', parent_id: null, pos: 0, at: 1, v: 1, deleted_at: null } },
  { table: 'goals', parse: parseGoalRow, sample: { id: 'goal_1', collection_id: null, title: 't', kind: 'midterm', date: null, status: 'open', score: null, created_by: 'user', ...S, ...D } },
  { table: 'objectives', parse: parseObjectiveTableRow, sample: { id: 'obj_1', collection_id: 'col_1', num: null, text: 't', chapters: null, source_ref: null, created_by: 'user', ...S, ...D } },
  { table: 'links', parse: parseLinkRow, sample: { id: 'link_1', from_kind: 'note', from_id: 'note_1', to_kind: 'goal', to_id: 'goal_1', by: 'user', note: null, ...S, ...D } },
  { table: 'notes', parse: parseNoteTableRow, sample: { id: 'note_1', collection_id: null, title: 't', body: {}, text: '', earlier_of: null, ...S, ...D } },
  {
    table: 'sets',
    parse: parseSetTableRow,
    sample: { id: 'set_1', collection_id: null, kind: 'own', title: null, source_kind: null, source_id: null, created_by: 'user', job_id: null, focus: null, asked: null, ...S, ...D },
  },
  {
    table: 'set_items',
    parse: parseSetItemRow,
    sample: { id: 'item_1', set_id: 'set_1', pos: 0, type: 'single', body: {}, objective_id: null, weak_spot_id: null, source_ref: null, ...S, ...D },
  },
  { table: 'set_item_versions', parse: parseSetItemVersionRow, sample: { id: 'item_1@1', item_id: 'item_1', item_v: 1, body: {}, at: 1, v: 1 } },
  {
    table: 'weak_spots',
    parse: parseWeakSpotTableRow,
    sample: { id: 'ws_1', collection_id: null, objective_id: null, topic: 't', kind: 'concept', words: null, source_line: 's', duplicate_of: null, proposed: 0, created_by: 'user', pre_read: 0, reading_due: null, ...S, ...D },
  },
  {
    table: 'weak_spot_events',
    parse: parseWeakSpotEventRow,
    sample: { id: 'wse_1', weak_spot_id: 'ws_1', type: 'seen', by: 'user', note: null, objective_id: null, until: null, ...S },
  },
  {
    table: 'attempts',
    parse: parseAttemptRow,
    sample: { id: 'att_1', item_id: 'item_1', item_v: 1, set_id: 'set_1', session_id: null, source: 'run', how: 'chose', answer: null, score: null, answered_at: 1, ...S },
  },
  {
    table: 'sessions',
    parse: parseSessionTableRow,
    sample: { id: 'ses_1', kind: 'note', note_id: null, set_id: null, collection_id: null, day: '2026-11-05', status: 'active', planned_min: null, started_at: null, ended_at: null, topic: null, clock: null, minutes: null, driver: null, ...S, ...D },
  },
  { table: 'session_events', parse: parseSessionEventRow, sample: { id: 'sese_1', session_id: 'ses_1', type: 'start', body: null, ...S } },
  { table: 'files', parse: parseFileRow, sample: { id: 'file_1', kind: 'note_image', type: 'image/png', size: 1, sha256: 'a'.repeat(64), r2_key: 'note-images/a.png', owner_kind: 'note', owner_id: 'note_1', ...S, ...D } },
  {
    table: 'talk',
    parse: parseTalkRow,
    sample: { id: 'talk_1', chat_id: 'c', scope: 'ask', session_id: null, context_kind: null, context_id: null, role: 'user', text: 't', cites: null, job_id: null, ...S },
  },
  { table: 'plans', parse: parsePlanTableRow, sample: { id: 'plan_1', goal_id: 'goal_1', job_id: null, state: 'draft', title: null, from_day: '2026-11-05', to_day: '2026-11-12', summary: null, ...S, ...D } },
  {
    table: 'plan_items',
    parse: parsePlanItemTableRow,
    sample: { id: 'pli_1', plan_id: null, day: '2026-11-05', pos: 0, title: 't', minutes: null, time: null, origin: 'user', linked_kind: null, linked_id: null, repeat_id: null, done_at: null, ...S, ...D },
  },
  {
    table: 'repeats',
    parse: parseRepeatRow,
    sample: { id: 'rep_1', title: 't', minutes: null, time: null, rule: {}, from_day: '2026-11-05', to_day: null, linked_kind: null, linked_id: null, ...S, ...D },
  },
  { table: 'memberships', parse: parseMembership, sample: { itemC: 'notes', itemId: 'n1', collectionId: 'c1', at: T, v: 1 } },
  { table: 'pins', parse: parsePinTableRow, sample: { id: 'pin_1', target_kind: 'notes', target_id: 'n1', pos: 0, ...S, ...D }, extra: ['target_c'] },
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
  {
    table: 'drafts',
    parse: parseDraftTableRow,
    sample: { id: 'draft_1', job_id: 'j', kind: 'set-item', target_kind: 'own_sets', target_id: 's1', body: {}, state: 'pending', ...S },
    extra: ['target_c'],
  },
  { table: 'settings', parse: parseSettingRow, sample: { key: 'ceiling_daily', value: 1, ...S } },
  { table: 'deletions', parse: parseDeletion, sample: { c: 'notes', id: 'n1', at: 1 } },
  { table: 'job_plans', parse: parseJobPlanRow, sample: { jobId: 'j', kind: 'plan', body: {}, at: 1 } },
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
  for (const { table, parse, sample, expand = {}, stored = [], extra = [] } of tables) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; notnull: number; pk: number }[];
    const keys = Object.keys(parse(sample)).filter((k) => !stored.includes(k));
    const want = keys.flatMap((k) => expand[k] ?? [snake(k)]);
    if (stored.length) want.push('data', 'at');
    want.push(...extra);
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
    goals: ['collection_id', 'date'],
    objectives: ['collection_id'],
    links: ['to_kind,to_id', 'from_kind,from_id'],
    notes: ['collection_id', 'earlier_of'],
    sets: ['collection_id', 'source_kind,source_id', 'job_id'],
    set_items: ['set_id,pos', 'objective_id', 'weak_spot_id'],
    set_item_versions: ['item_id,item_v'],
    weak_spots: ['objective_id', 'collection_id', 'duplicate_of'],
    weak_spot_events: ['weak_spot_id,at', 'objective_id'],
    attempts: ['item_id,at', 'set_id,at', 'session_id'],
    sessions: ['note_id', 'set_id', 'collection_id'],
    session_events: ['session_id,at'],
    talk: ['chat_id,at', 'session_id'],
    files: ['owner_kind,owner_id', 'r2_key'],
    memberships: ['collection_id'],
    pins: ['target_kind,target_id'],
    own_sets: ['source_c,source_id'],
    item_props: ['linked_c,linked_id'],
    drafts: ['job_id', 'target_c,target_id'],
    plans: ['goal_id', 'job_id'],
    plan_items: ['day', 'plan_id', 'linked_kind,linked_id'],
    repeats: ['linked_kind,linked_id'],
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

test('plans allow one in force per goal; a repeat puts one row on a day (§data.repeat)', () => {
  const db = built();
  const plan = db.prepare("INSERT INTO plans (id, goal_id, state, from_day, to_day, at) VALUES (?, 'goal_1', ?, '2026-11-05', '2026-11-12', 1)");
  plan.run('plan_1', 'in_force');
  plan.run('plan_2', 'draft');
  assert.throws(() => plan.run('plan_3', 'in_force'));
  db.exec("UPDATE plans SET deleted_at = 2 WHERE id = 'plan_1'");
  assert.doesNotThrow(() => plan.run('plan_3', 'in_force'));
  assert.throws(() => plan.run('x_4', 'draft'), /CHECK/); // the id prefix
  const row = db.prepare("INSERT INTO plan_items (id, day, pos, title, origin, repeat_id, at) VALUES (?, ?, 0, 't', 'morning', ?, 1)");
  row.run('pli_1', '2026-11-05', 'rep_1');
  row.run('pli_2', '2026-11-06', 'rep_1');
  row.run('pli_3', '2026-11-05', null);
  row.run('pli_4', '2026-11-05', null);
  assert.throws(() => row.run('pli_5', '2026-11-05', 'rep_1'));
});
