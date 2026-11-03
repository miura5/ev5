// Shared by the custom checks: list the repo's files and the Finding shape. Every check is a pure function over a root.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type Finding = { check: string; file: string; detail: string };
const SKIP = new Set(['node_modules', '.git', 'dist', '.claude']);

// Tracked and untracked-but-not-ignored files under a git repo; a plain walk elsewhere (tests use temp dirs).
export function listFiles(root: string): string[] {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\0').filter(f => f && fs.existsSync(path.join(root, f)));
  } catch {
    const walk = (d: string): string[] =>
      fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e =>
        SKIP.has(e.name) ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    return walk('');
  }
}

export const read = (root: string, file: string): string => fs.readFileSync(path.join(root, file), 'utf8');
