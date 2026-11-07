// e2e journeys, staging seeds and ops scripts write through commands, never by PUT to /docs (§data.gate, §drift.checks).
// A file under e2e/, data/staging/ or ops/ that issues a PUT and names /docs is refused. Reads (GET) are fine.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const SCANNED = /^(?:e2e|data\/staging|ops)\//;
const SKIPPED = /^ops\/(?:checks|guards)\/|^ops\/record\/fixtures/;
const PUT = /["'`]PUT["'`]|-X\s*PUT|--request\s+PUT|method:\s*["'`]PUT/;

// Existing violations found 2026-11-06, each moved to a command by the task that moves its kind.
// Remove a file when it is clean; never add one.
const ALLOWED = new Set(['e2e/notes.journey.spec.ts', 'e2e/practice-set.journey.spec.ts', 'e2e/prep-plan.journey.spec.ts']);

export function checkDocsWrites(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!SCANNED.test(f) || SKIPPED.test(f) || ALLOWED.has(f) || !/\.(?:[cm]?[jt]sx?|sh|sql|py|ya?ml)$/.test(f)) continue;
    const src = read(root, f);
    if (!src.includes('/docs')) continue;
    const i = src.split('\n').findIndex(l => PUT.test(l));
    if (i >= 0) out.push({ check: 'docs-writes', file: f, detail: `line ${i + 1} writes by PUT /docs; write through a command instead (§data.gate)` });
  }
  return out;
}
