// A kind written to the generic docs table must be on a shrinking list of kinds still moving. Each kind gets its own
// table (docs/proposals/table-design.md section 2, the Chart's table-design decision); when its table, command and
// reads land, the kind leaves ALLOWED here in the same PR. A new kind is never added, so no new document kind can
// appear while the others move. Once docs is gone the list is empty and a later check bans docs outright (§drift.checks).
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

// Kinds still written to docs, each until its own table lands. Remove a name when its move merges; never add one.
export const ALLOWED = new Set<string>([
  'answers',
  'dayedits',
  'exams',
  'plans',
  'talk',
]);

const KIND = `["'\`]([a-z][a-z_]*)["'\`]`;
// A write verb with the kind as its first argument (after the handler context `x`, or inside a `[kind, id]` pair), or the outbox's kind
// argument, or a kind field in a row being saved. Reads (get, list, need) are not writes and are not matched.
const WRITE = new RegExp(`\\b(?:save|rename|markDeleted|edit|put|addEvent)\\(\\s*(?:x\\s*,\\s*)?\\[?\\s*${KIND}|\\boutbox\\s*,\\s*${KIND}|\\b(?:c|itemC):\\s*${KIND}`, 'g');
const SCANNED = /^(?:server|jobs|commands|data|shell|areas)\/.+\.tsx?$/;
const SKIPPED = /\.test\.tsx?$|^data\/(?:docs|protocol|staging)\//;

export function checkDocsKinds(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!SCANNED.test(f) || SKIPPED.test(f)) continue;
    const src = read(root, f);
    const seen = new Set<string>();
    for (const m of src.matchAll(WRITE)) {
      const kind = m[1] ?? m[2] ?? m[3];
      if (kind === undefined || ALLOWED.has(kind) || seen.has(kind)) continue;
      seen.add(kind);
      const line = src.slice(0, m.index).split('\n').length;
      out.push({ check: 'docs-kinds', file: f, detail: `line ${line} writes kind "${kind}" to the generic docs table; give it its own table and command (docs/proposals/table-design.md), or, if it is an old kind still moving, name it in ops/checks/docskinds.ts ALLOWED` });
    }
  }
  return out;
}
