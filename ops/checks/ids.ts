// No decision or task ids in code or docs (CONTRACT §drift.no-ids): D-nnn and B-nnn in source, CSS, prompts and READMEs.
// The record, history and the rule files themselves are where ids belong.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const ID = /(?<![\w-])[DB]-\d{1,4}\b/;
const EXEMPT =
  /^(?:chart|docs\/record|docs\/history|docs\/contract|ops\/record)\/|^(?:CONTRACT|PLAN|AGENTS|CLAUDE|BACKLOG|DECISIONS|CHANGELOG)\.md$|^docs\/handover\.md$|(?:^|\/)package-lock\.json$|\.(?:png|jpe?g|gif|webp|ico|woff2?|pdf|zip)$/;

export function checkIds(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (EXEMPT.test(f)) continue;
    read(root, f).split('\n').forEach((line, i) => {
      const m = ID.exec(line);
      if (m) out.push({ check: 'ids', file: f, detail: `line ${i + 1} gives ${m[0]}: say the behaviour instead (§drift.no-ids)` });
    });
  }
  return out;
}
