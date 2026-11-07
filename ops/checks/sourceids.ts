// A §id cited in source (code, styles, scripts, configs; not tests, which quote fake ids as fixtures) must be a rule
// in CONTRACT.md and not an ended one (§drift.checks, §drift.current). Markdown is checked by ops/checks/rules.ts.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';
import { contractRules } from './rules.ts';

const ID = /§[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9.-]*[a-z0-9]/g;
const SCANNED = /\.(?:tsx?|css|[cm]?js|sh|jsonc?|ya?ml|html)$/;
const SKIPPED = /(?:^|\/)(?:node_modules|dist|chart)\/|\.test\.tsx?$|^package-lock\.json$/;

export function checkSourceIds(root: string, files: string[]): Finding[] {
  if (!files.includes('CONTRACT.md')) return [];
  const rules = contractRules(read(root, 'CONTRACT.md'));
  const ended = new Set(files.includes('docs/contract/ended.md')
    ? [...read(root, 'docs/contract/ended.md').matchAll(/^[-|] ?(§[a-z0-9.-]+)/gm)].map(m => m[1]!) : []);
  const out: Finding[] = [];
  for (const f of files) {
    if (!SCANNED.test(f) || SKIPPED.test(f)) continue;
    const seen = new Set<string>();
    read(root, f).split('\n').forEach((text, i) => {
      for (const id of text.match(ID) ?? []) {
        if (seen.has(id) || (rules.has(id) && !ended.has(id))) continue;
        seen.add(id);
        const why = ended.has(id) ? 'ended' : 'not defined in CONTRACT.md';
        out.push({ check: 'source-ids', file: f, detail: `line ${i + 1} cites ${id}, which is ${why}; cite a live rule or drop the citation (§drift.checks)` });
      }
    });
  }
  return out;
}
