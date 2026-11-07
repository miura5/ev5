// e2e, seeds and staging scripts write through commands, never by PUT /docs (§data.gate, §drift.checks). A file in
// that scope fails when a line names a /docs route together with PUT, or sends a PUT to a path ending /docs.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const SCOPE = /^(?:e2e\/|data\/staging\/|ops\/(?:staging|seed)[^/]*\/|scripts\/|\.github\/workflows\/)/;
const SKIPPED = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.testkit\.ts$|\.md$|\.png$/;
const DOCS_ROUTE = /\/docs(?![\w-])/;
const PUT = /\bPUT\b|\.put\(|-X\s*PUT/;

export function checkDocsWrite(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!SCOPE.test(f) || SKIPPED.test(f)) continue;
    const lines = read(root, f).split('\n');
    const i = lines.findIndex(l => DOCS_ROUTE.test(l) && PUT.test(l));
    if (i >= 0) out.push({ check: 'docs-write', file: f, detail: `line ${i + 1} writes by PUT /docs; write through a command (§data.gate)` });
  }
  return out;
}
