// Every test file runs in CI: a *.test.* file must be collected by the include lists of vitest projects.
import path from 'node:path';
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const TEST = /\.test\.(?:ts|tsx|mjs|js)$/;
const quoted = (s: string): string[] => [...s.matchAll(/"([^"]+)"/g)].map(m => m[1] as string);

// node --test arguments: a folder collects every test file under it, a glob collects the files it matches.
export function nodeCollects(script: string, file: string): boolean {
  const args = script.replace(/^node --test\s+/, '').split(/\s+/).filter(Boolean);
  return args.some(a => (a.endsWith('/') ? file.startsWith(a) : path.matchesGlob(file, a)));
}

export function checkTestRuns(root: string, files: string[]): Finding[] {
  if (!files.includes('package.json') || !files.includes('vite.config.ts')) return [];
  const scripts = (JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> }).scripts;
  const node = scripts['test:node'] ?? '';
  const config = read(root, 'vite.config.ts').replace(/^\s*\/\/.*$/gm, '');
  const vitest = [...config.matchAll(/\binclude:\s*\[([^\]]*)\]/g)].flatMap(m => quoted(m[1] as string));
  return files
    .filter(f => TEST.test(f) && !f.startsWith('e2e/'))
    .filter(f => !nodeCollects(node, f) && !vitest.some(g => path.matchesGlob(f, g)))
    .map(f => ({ check: 'testruns', file: f, detail: 'no runner collects it: add it to test:node in package.json or to vitest include in vite.config.ts' }));
}
