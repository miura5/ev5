// The old app's name must not appear in non-test source: v5 stands on its own (§drift.checks, §data.own-db). Only the
// cutover files may name it. Tests, the Chart, docs and Markdown are history or fixtures and are not scanned.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

// The word is spelled in two pieces so this file does not contain it.
const WORD = new RegExp(`\\b(?:ev${4})\\b`, 'i');
const SCANNED = /\.(?:tsx?|css|[cm]?js|sh|sql|jsonc?|toml|ya?ml|html)$/;
const SKIPPED = /(?:^|\/)(?:node_modules|dist|chart|docs|fixtures-[\w-]+|guards|e2e)\/|\.(?:test|spec)\.tsx?$|^package-lock\.json$/;

// This file (it lists the cutover files by name) and the cutover files, which retire the old app on purpose; they go when the cutover is done.
const CUTOVER = ['ops/checks/ev4word.ts', 'server/ev4-routes.ts', 'server/worker.ts', 'public/retire-ev4.js', 'ops/checks/planjob.ts', 'ops/checks/account.ts'];
const CUTOVER_FOLDERS = ['ops/record/'];

// Files outside this check's slice that still carry the word, found when the check landed. SHRINKS: reword the hit in
// the file's own task and delete its line here. Never add one.
const TO_REWORD = new Set<string>([
  '.github/workflows/live.yml',
  'data/migrations/0000_baseline.sql',
  'data/migrations/0001_deletions.sql',
  'data/migrations/0002_jobs_ceilings.sql',
  'data/migrations/0003_collections_pins_own.sql',
  'data/migrations/0005_pointer_indexes.sql',
  'ops/checks/migrationnames.ts',
  'server/handlers-edit.ts',
  'server/handlers-sets.ts',
  'server/index.ts',
  'vite.config.ts',
  'wrangler.jsonc',
]);

export function checkEv4Word(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!SCANNED.test(f) || SKIPPED.test(f) || CUTOVER.includes(f) || CUTOVER_FOLDERS.some(d => f.startsWith(d)) || TO_REWORD.has(f)) continue;
    const i = read(root, f).split('\n').findIndex(t => WORD.test(t));
    if (i >= 0) out.push({ check: 'ev4-word', file: f, detail: `line ${i + 1} names the old app; reword it in v5 terms (§drift.checks)` });
  }
  return out;
}
