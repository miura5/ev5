// Secrets scan (PLAN §10, §hard.no-secrets-in-files): key and token shapes, private keys, and a .dev.vars file.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const SHAPES: [RegExp, string][] = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, 'an Anthropic key'],
  [/\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/, 'a GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS key id'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
  [/\b(?:api[_-]?key|token|secret|password|bearer)\w*["']?\s*[:=]\s*["'][A-Za-z0-9_\-+/=]{24,}["']/i, 'a hard-coded credential'],
];
const SKIP = /\.(?:png|jpe?g|gif|webp|ico|woff2?|pdf|zip)$|(?:^|\/)package-lock\.json$/;

export function checkSecrets(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    if (/(?:^|\/)\.dev\.vars(?:\..*)?$/.test(f)) out.push({ check: 'secrets', file: f, detail: 'a .dev.vars file is in the repo' });
    if (SKIP.test(f)) continue;
    read(root, f).split('\n').forEach((line, i) => {
      for (const [re, what] of SHAPES) if (re.test(line)) out.push({ check: 'secrets', file: f, detail: `line ${i + 1} looks like ${what}` });
    });
  }
  return out;
}
