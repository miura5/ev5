// An export used only by its tests is dead code the tests keep alive. knip --production counts only the app's entry
// points (knip.production.json, tests left out), so it reports what nothing but a test imports (§drift.checks).
// Runs only where a root has knip.production.json and knip installed. Folders still waiting for their first consumer
// are in that file's ignoreIssues, each line to leave when its consumer lands.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from './lib.ts';

export function checkUnusedExports(root: string): Finding[] {
  const knip = path.join(root, 'node_modules/.bin/knip');
  if (!fs.existsSync(path.join(root, 'knip.production.json')) || !fs.existsSync(knip)) return [];
  const r = spawnSync(knip, ['--production', '-c', 'knip.production.json', '--include', 'exports', '--reporter', 'json'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  let issues: { file: string; exports?: { name: string; line: number }[] }[];
  try { issues = (JSON.parse(r.stdout) as { issues: typeof issues }).issues; } catch { return [{ check: 'unused-exports', file: 'knip.production.json', detail: `knip did not run: ${(r.stderr || r.stdout).trim().slice(0, 200)}` }]; }
  return issues.flatMap(i => (i.exports ?? []).map(e => ({
    check: 'unused-exports', file: i.file,
    detail: `line ${e.line} exports ${e.name}, which only tests import; use it in the app, un-export it, or delete it with its tests (§drift.checks)`,
  })));
}
