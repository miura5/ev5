// Stack check: the stack table in README.md matches package.json. Every package the table names (a `name`, or a
// `prefix-*` group) is installed, and every runtime dependency has a row. Only the table's Packages column is read.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const START = '<!-- stack:start -->';
const END = '<!-- stack:end -->';

export function checkStack(root: string, files: string[]): Finding[] {
  if (!files.includes('README.md') || !files.includes('package.json')) return [];
  const out: Finding[] = [];
  const add = (detail: string): void => void out.push({ check: 'stack', file: 'README.md', detail });
  const text = read(root, 'README.md');
  if (!text.includes(START) || !text.includes(END)) return [{ check: 'stack', file: 'README.md', detail: `no ${START} ... ${END} table` }];
  const pkg = JSON.parse(read(root, 'package.json')) as { dependencies?: object; devDependencies?: object };
  const runtime = Object.keys(pkg.dependencies ?? {});
  const installed = [...runtime, ...Object.keys(pkg.devDependencies ?? {})];
  const names = text.slice(text.indexOf(START), text.indexOf(END)).split('\n')
    .filter(l => l.startsWith('|')).flatMap(l => [...(l.split('|')[2] ?? '').matchAll(/`([^`]+)`/g)].map(m => m[1]!));
  const covers = (name: string, dep: string): boolean => name.endsWith('*') ? dep.startsWith(name.slice(0, -1)) : dep === name;
  for (const n of names) if (!installed.some(d => covers(n, d))) add(`names ${n}, which package.json does not install`);
  for (const d of runtime) if (!names.some(n => covers(n, d))) add(`has no row for the dependency ${d}`);
  return out;
}
