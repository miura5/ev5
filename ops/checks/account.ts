// Account separation (CONTRACT §sec.account): no non-live config or workflow names the live Worker or its D1.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const CONFIG = /(?:^|\/)wrangler[^/]*\.(?:jsonc?|toml)$|^\.github\/workflows\/[^/]+\.ya?ml$/;
const ALLOWED = new Set(['.github/workflows/live.yml']);
const LIVE = /\bev-live\b/i;

export function checkAccount(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (!CONFIG.test(f) || ALLOWED.has(f)) continue;
    read(root, f).split('\n').forEach((line, i) => {
      if (LIVE.test(line)) out.push({ check: 'account', file: f, detail: `line ${i + 1} names ev-live outside the live workflow` });
    });
  }
  return out;
}
