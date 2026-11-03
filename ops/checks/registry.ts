// Registry (PLAN §11): no tool, button or schedule entry is defined outside commands/. Heuristic patterns only;
// the registry generates these, so a hand-written one elsewhere is a second definition.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const PATTERNS: [RegExp, string][] = [
  [/\binput_schema\s*:/, 'a Claude tool definition'],
  [/\b(?:registerTool|defineTool|registerCommand|defineCommand)\s*\(/, 'a command or tool registration'],
  [/\bcrons?\s*[:=]\s*\[|^\s*crons\s*=/m, 'a schedule entry'],
];
const IN_SCOPE = /\.(?:ts|tsx|js|mjs|toml|json)$/;
const EXEMPT = /^(?:commands|ops\/checks|docs|spike|chart)\/|\.(?:test|generated)\.|(?:^|\/)package(?:-lock)?\.json$/;

export function checkRegistry(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!IN_SCOPE.test(f) || EXEMPT.test(f)) continue;
    const text = read(root, f);
    for (const [re, what] of PATTERNS) if (re.test(text)) out.push({ check: 'registry', file: f, detail: `${what} outside commands/` });
  }
  return out;
}
