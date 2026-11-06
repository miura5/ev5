// data/compat held ev4's frozen schemas and ended on 2026-11-05 (§data.own-db). No file may import it, and no
// data/compat path may come back (§drift.checks). Tests are scanned too: a test of ev4 shapes is the same trace.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const IMPORT = /(?:from|import|require\()\s*\(?\s*["'`][^"'`]*\bcompat\b[^"'`]*["'`]/;

export function checkCompatImport(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (f.startsWith('data/compat/')) out.push({ check: 'compat-import', file: f, detail: 'data/compat ended (§data.own-db); delete it' });
    if (!/\.[cm]?[jt]sx?$/.test(f) || f.startsWith('ops/checks/')) continue;
    const i = read(root, f).split('\n').findIndex(l => IMPORT.test(l));
    if (i >= 0) out.push({ check: 'compat-import', file: f, detail: `line ${i + 1} imports a compat module; v5 has its own database, so ev4's shapes have no place here (§data.own-db)` });
  }
  return out;
}
