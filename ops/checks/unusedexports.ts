// An export used only by its tests is dead code the tests keep alive. knip --production counts only the app's entry
// points (knip.production.json, tests left out), so it reports what nothing but a test imports (§drift.checks).
// Runs only where a root has knip.production.json and knip installed. Folders still waiting for their first consumer
// are in that file's ignoreIssues, each line to leave when its consumer lands.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from './lib.ts';

const hasFiles = (p: string): boolean => fs.existsSync(p) && (fs.statSync(p).isFile() || fs.readdirSync(p, { recursive: true, withFileTypes: true }).some(e => e.isFile()));

export function checkUnusedExports(root: string): Finding[] {
  const knip = path.join(root, 'node_modules/.bin/knip');
  const cfgPath = path.join(root, 'knip.production.json');
  if (!fs.existsSync(cfgPath) || !fs.existsSync(knip)) return [];
  // Run without the allow-list and apply it here, so an entry nothing needs any more can be refused.
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { ignoreIssues?: Record<string, string[]> };
  const allowed = Object.keys(cfg.ignoreIssues ?? {}).map(g => g.replace(/\*\*$/, ''));
  const tmp = path.join(root, '.knip.production.check.json');
  fs.writeFileSync(tmp, JSON.stringify({ ...cfg, ignoreIssues: undefined }));
  const r = spawnSync(knip, ['--production', '-c', tmp, '--include', 'exports', '--reporter', 'json'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  fs.rmSync(tmp, { force: true });
  let issues: { file: string; exports?: { name: string; line: number }[] }[];
  try { issues = (JSON.parse(r.stdout) as { issues: typeof issues }).issues; } catch { return [{ check: 'unused-exports', file: 'knip.production.json', detail: `knip did not run: ${(r.stderr || r.stdout).trim().slice(0, 200)}` }]; }
  const live = issues.filter(i => (i.exports ?? []).length > 0);
  const stale = allowed.filter(a => hasFiles(path.join(root, a)) && !live.some(i => i.file.startsWith(a)))
    .map(a => ({ check: 'unused-exports', file: 'knip.production.json', detail: `ignoreIssues entry ${a}** has no test-only export left; remove the line (§drift.checks)` }));
  const found = live.filter(i => !allowed.some(a => i.file.startsWith(a))).flatMap(i => (i.exports ?? []).map(e => ({
    check: 'unused-exports', file: i.file,
    detail: `line ${e.line} exports ${e.name}, which only tests import; use it in the app, un-export it, or delete it with its tests (§drift.checks)`,
  })));
  return [...found, ...stale];
}
