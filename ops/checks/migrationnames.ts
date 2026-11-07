// wrangler applies every `.sql` file in data/migrations, so only numbered `NNNN_name.sql` files may sit there (§data.migrations,
// §drift.checks). A schema fixture or scratch script goes elsewhere. The one named exception is the old schema fixture,
// which staging already recorded as applied; do not add to this list.
import type { Finding } from './lib.ts';

const ALLOWED = new Set(['data/migrations/ev4-schema.fixture.sql']);
const NUMBERED = /^data\/migrations\/\d{4}_[a-z0-9_]+\.sql$/;

export function checkMigrationNames(files: string[]): Finding[] {
  return files
    .filter(f => /^data\/migrations\/[^/]+\.sql$/i.test(f) && !NUMBERED.test(f) && !ALLOWED.has(f))
    .map(file => ({ check: 'migration-names', file, detail: 'only numbered NNNN_name.sql files may sit in data/migrations: wrangler applies every .sql there' }));
}
