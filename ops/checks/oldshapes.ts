// The old app's storage shapes must not come back in non-test source (§drift.checks, §data.own-db): SQL naming the
// generic `docs` table, the old collection names, and the old envelope. The data/compat import is refused by compatimport.ts.
// Tests are fixtures and are not scanned; neither are the Chart, docs and Markdown.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const SCANNED = /\.(?:tsx?|[cm]?js|sql|sh)$/;
const SKIPPED = /(?:^|\/)(?:node_modules|dist|chart|docs|fixtures-[\w-]+|guards|e2e)\/|\.(?:test|spec)\.tsx?$/;
// The cutover files retire the old app on purpose and go with it.
const CUTOVER = [`server/ev${4}-routes.ts`, 'server/worker.ts', 'ops/checks/planjob.ts', 'ops/checks/account.ts'];
// Files that still write the old envelope; the goal reader goes when its caller stops asking for it. Never add one.
const TO_REWORD = new Set<string>(['domain/goal/read.ts']);
const COLLECTIONS = ['dayedits', 'planedits', 'dateedits', 'examedits', 'answers'].join('|');

const RULES: { re: RegExp; what: string }[] = [
  { re: /\b(?:from|into|update|join|table|exists)\s+["`[]?docs\b/i, what: 'SQL naming the docs table' },
  { re: new RegExp(`["'\`](?:${COLLECTIONS})["'\`]|\\b(?:from|into|update|join|table)\\s+(?:${COLLECTIONS})\\b`, 'i'), what: 'an old collection name' },
  { re: /\bsource\s*:\s*["'`]v5/, what: 'the old envelope (a source starting v5)' },
];
const COMMENT = /^\s*(?:\/\/|\/?\*|#|--)/;

export function checkOldShapes(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!SCANNED.test(f) || SKIPPED.test(f) || CUTOVER.includes(f) || TO_REWORD.has(f) || f.startsWith('ops/record/') || f === 'ops/checks/oldshapes.ts') continue;
    const lines = read(root, f).split('\n');
    for (const { re, what } of RULES) {
      const i = lines.findIndex(l => !COMMENT.test(l) && re.test(l));
      if (i >= 0) out.push({ check: 'old-shapes', file: f, detail: `line ${i + 1} has ${what}; v5 has its own tables (§data.own-db, §drift.checks)` });
    }
  }
  return out;
}
