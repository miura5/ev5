// Interface trailer (PLAN §11): a commit that changes a folder's interface (index.ts, schemas, commands, jobs)
// carries an `Interface: <folder>` trailer naming that folder.
import { execFileSync } from 'node:child_process';
import type { Finding } from './lib.ts';

export type Commit = { sha: string; message: string; files: string[] };
const INTERFACE = /(?:^|\/)(?:index\.ts|[^/]+\.(?:schema|command|job)\.ts)$/;

export function checkTrailers(commits: Commit[]): Finding[] {
  const out: Finding[] = [];
  for (const c of commits) {
    const named = [...c.message.matchAll(/^Interface:[ \t]*(\S+)[ \t]*$/gim)].map(m => m[1]!.replace(/\/$/, ''));
    for (const f of c.files.filter(x => INTERFACE.test(x))) {
      const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.';
      if (!named.some(n => dir === n || dir.startsWith(`${n}/`))) {
        out.push({ check: 'trailer', file: f, detail: `${c.sha.slice(0, 8)} changes an interface without an "Interface: ${dir}" trailer` });
      }
    }
  }
  return out;
}

// The commits of a branch since its base; none when there is no base (a push to main).
export function branchCommits(root: string, base: string | undefined): Commit[] {
  if (!base) return [];
  const git = (...a: string[]): string => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8' });
  return git('rev-list', '--no-merges', `${base}..HEAD`).split('\n').filter(Boolean).map(sha => ({
    sha,
    message: git('log', '-1', '--format=%B', sha),
    files: git('diff-tree', '--no-commit-id', '--name-only', '-r', sha).split('\n').filter(Boolean),
  }));
}
