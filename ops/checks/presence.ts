// Presence (PLAN §11): every component has a story and a test, every command and job a test.
import type { Finding } from './lib.ts';

export function checkPresence(_root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  const need = (owner: string, want: string[]): void => {
    if (!want.some(w => files.includes(w))) out.push({ check: 'presence', file: owner, detail: `missing ${want[0]}` });
  };
  const comps = new Set(files.map(f => /^kit\/components\/([^/]+)\//.exec(f)?.[1]).filter((c): c is string => !!c));
  for (const c of comps) {
    const base = `kit/components/${c}/${c}`;
    need(`kit/components/${c}`, [`${base}.story.tsx`]);
    need(`kit/components/${c}`, [`${base}.test.ts`, `${base}.test.tsx`]);
  }
  for (const f of files) {
    const m = /^((?:commands|jobs)\/.*\.(?:command|job))\.ts$/.exec(f);
    if (m) need(f, [`${m[1]}.test.ts`, `${m[1]}.test.tsx`]);
    const j = /^(jobs\/[^/]+)\/job\.ts$/.exec(f);
    if (j) need(f, [`${j[1]}/job.test.ts`, `${j[1]}/job.test.tsx`]);
  }
  return out;
}
