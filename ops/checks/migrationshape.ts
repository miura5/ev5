// Every table in data/migrations is held to the table rules (§data.tables, §data.protocol, §drift.checks): a table made
// since the kind-table design has a kind-prefixed id (a CHECK on substr(id, ...)), `at` and `v`; and every table is named
// in data/migrations/row-shapes.test.ts, which holds its columns to its domain row shape (so `deleted_at`, which only
// the row shape knows is wanted, is checked there, and here for tables not named in APPEND_ONLY). A table that predates the design is on LEGACY until its move lands.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

// Tables made before the kind-table design, with ids that carry no kind prefix (or no row shape of their own).
// Dated 2026-11-06; remove a name when its table moves or goes, never add one.
const LEGACY = new Set(['job_records', 'ceiling_use', 'ceiling_holds', 'job_plans', 'drafts', 'own_set_items', 'collections', 'memberships', 'pins', 'item_props', 'own_sets', 'ceiling_usage']);
// Keyed by name, not by a kind-prefixed id (table design 2.14): the id rule does not apply, `at` and `v` still do.
const KEYED = new Set(['settings']);
// Append-only tables, which the user never deletes (§delete.soft): no `deleted_at`. Every other new table has one.
// Naming a table here is the one place that says it is append-only; row-shapes.test.ts then holds the columns to the parser.
const APPEND_ONLY = new Set(['set_item_versions', 'weak_spot_events', 'attempts', 'session_events', 'talk', 'drafts', 'settings']);
const TABLE = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g;

export function checkMigrationShape(root: string, files: string[]): Finding[] {
  const shapes = files.includes('data/migrations/row-shapes.test.ts') ? read(root, 'data/migrations/row-shapes.test.ts') : null;
  const out: Finding[] = [];
  for (const f of files.filter(n => /^data\/migrations\/\d{4}_.*\.sql$/.test(n))) {
    for (const m of read(root, f).matchAll(TABLE)) {
      const [, name = '', body = ''] = m;
      const cols = new Set(body.split('\n').map(l => l.trim().match(/^"?(\w+)"?/)?.[1]));
      const say = (detail: string): number => out.push({ check: 'migration-shape', file: f, detail: `table ${name}: ${detail}` });
      if (!LEGACY.has(name)) {
        if (!KEYED.has(name) && !/\bid TEXT PRIMARY KEY CHECK \(substr\(id,/.test(body)) say('id must be TEXT PRIMARY KEY CHECK (substr(id, ...) = \'<kind>_\') so it carries its kind (§data.tables)');
        if (!APPEND_ONLY.has(name) && !cols.has('deleted_at')) say('missing column deleted_at; a table the user can delete from needs it (§delete.soft), or name it in APPEND_ONLY');
        if (APPEND_ONLY.has(name) && cols.has('deleted_at')) say('is append-only, so it has no deleted_at (§delete.soft)');
        for (const c of ['at', 'v']) if (!cols.has(c)) say(`missing column ${c} (§data.protocol)`);
      }
      if (shapes !== null && !new RegExp(`table: '${name}'`).test(shapes)) say('not in data/migrations/row-shapes.test.ts; add its domain row parser and a sample there');
    }
  }
  return out;
}
