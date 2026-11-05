// Account separation (CONTRACT §sec.account): no non-live config or workflow names the live Worker or its D1.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const CONFIG = /(?:^|\/)wrangler[^/]*\.(?:jsonc?|toml)$|^\.github\/workflows\/[^/]+\.ya?ml$/;
const ALLOWED = new Set(['.github/workflows/live.yml']);
const LIVE = /\bev-live\b/i;
// ev-live is also the name of ev4's live D1 (§data.own-db): no config or workflow, live.yml included, may bind it.
const EV4_D1 = /\bev-live\b(?![-\w])/i;
const D1_LINE = /d1|database|\bDB\b/i;

export function checkAccount(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!CONFIG.test(f)) continue;
    read(root, f).split('\n').forEach((line, i) => {
      if (EV4_D1.test(line) && D1_LINE.test(line)) out.push({ check: 'account', file: f, detail: `line ${i + 1} binds ev4's live D1 ev-live; v5 uses its own store` });
      else if (!ALLOWED.has(f) && LIVE.test(line)) out.push({ check: 'account', file: f, detail: `line ${i + 1} names ev-live outside the live workflow` });
    });
  }
  return out;
}
