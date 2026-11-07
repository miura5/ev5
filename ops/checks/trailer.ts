// Interface trailer (§drift.interface): a commit that changes the generated `Interface:` line of a folder's README
// carries an `Interface: <folder>` trailer naming that folder. Editing index.ts or a schema file without changing
// the listing needs none.
import { execFileSync } from 'node:child_process';
import type { Finding } from './lib.ts';

// `interfaces` holds the folders whose README `Interface:` line the commit changed ('.' for the root README).
export type Commit = { sha: string; message: string; interfaces: string[] };

export function checkTrailers(commits: Commit[]): Finding[] {
  const out: Finding[] = [];
  for (const c of commits) {
    const named = [...c.message.matchAll(/^Interface:[ \t]*(\S+)[ \t]*$/gim)].map(m => m[1]!.replace(/\/$/, ''));
    for (const dir of c.interfaces) {
      if (!named.some(n => dir === n || dir.startsWith(`${n}/`))) {
        const file = dir === '.' ? 'README.md' : `${dir}/README.md`;
        out.push({ check: 'trailer', file, detail: `${c.sha.slice(0, 8)} changes the interface listing without an "Interface: ${dir}" trailer` });
      }
    }
  }
  return out;
}

const listing = (text: string | undefined): string | undefined => /^Interface: .*$/m.exec(text ?? '')?.[0];

// The commits of a branch since its base; none when there is no base (a push to main).
export function branchCommits(root: string, base: string | undefined): Commit[] {
  if (!base) return [];
  const git = (...a: string[]): string => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8' });
  const show = (spec: string): string | undefined => {
    try { return git('show', spec); } catch { return undefined; }
  };
  return git('rev-list', '--no-merges', `${base}..HEAD`).split('\n').filter(Boolean).map(sha => ({
    sha,
    message: git('log', '-1', '--format=%B', sha),
    interfaces: git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).split('\n')
      .filter(f => f === 'README.md' || f.endsWith('/README.md'))
      .filter(f => { const after = show(`${sha}:${f}`); return after !== undefined && listing(show(`${sha}^:${f}`)) !== listing(after); })
      .map(f => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.')),
  }));
}
