// Rule check (PLAN §11): skills, READMEs, AGENTS.md and CLAUDE.md cite CONTRACT §ids. They may not cite an unknown or
// ended id, copy a CONTRACT line, state never/always/must without a §id, or run long. ("only" is not scanned: it is ordinary prose;
// "never imports" is exempt: import direction is enforced by dependency-cruiser, §drift.imports.)
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const ID = /§[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9.-]*[a-z0-9]/g;
const MAX = { README: 20, SKILL: 200, AGENTS: 250, CLAUDE: 20 };
const KINDS = Object.keys(MAX) as (keyof typeof MAX)[];

export function contractRules(text: string): Map<string, string> {
  const rules = new Map<string, string>();
  for (const m of text.matchAll(/^- (§[a-z0-9.-]+) · (.*?)(?: <!--.*)?$/gm)) rules.set(m[1]!, m[2]!);
  return rules;
}

export function checkRules(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  const rules = contractRules(read(root, 'CONTRACT.md'));
  const ended = new Set(files.includes('docs/contract/ended.md')
    ? [...read(root, 'docs/contract/ended.md').matchAll(/^[-|] ?(§[a-z0-9.-]+)/gm)].map(m => m[1]!) : []);
  for (const f of files) {
    const kind = KINDS.find(k => new RegExp(`(?:^|/)${k}\\.md$`).test(f));
    if (!kind || f.startsWith('docs/')) continue;
    const lines = read(root, f).replace(/<!--[\s\S]*?-->/g, '').split('\n');
    const add = (detail: string): void => void out.push({ check: 'rules', file: f, detail });
    if (lines.length > MAX[kind]) add(`${lines.length} lines, over ${MAX[kind]}`);
    for (const line of lines) {
      const ids = line.match(ID) ?? [];
      for (const id of ids) {
        if (ended.has(id)) add(`cites ended ${id}`);
        else if (!rules.has(id)) add(`cites ${id}, which CONTRACT.md does not define`);
      }
      for (const [id, body] of rules) if (body.length >= 40 && line.includes(body)) add(`copies the line of ${id}`);
      if (!ids.length && /\b(?:never(?! imports)|always|must)\b/i.test(line)) add(`states a rule without a §id: ${line.trim().slice(0, 60)}`);
    }
  }
  return out;
}
