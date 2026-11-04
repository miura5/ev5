// The rollback window keeps ev4's PlanJob (CONTRACT §deliver.window): worker.ts exports the class, and the Worker config
// binds it under ev4's binding and migration tag without ever deleting it.
import type { Finding } from './lib.ts';
import { read } from './lib.ts';

const BINDING = 'PLAN_JOBS';
const TAG = 'v1-plan-jobs';

export function checkPlanJob(root: string, files: string[]): Finding[] {
  const out: Finding[] = [];
  const bad = (file: string, detail: string): number => out.push({ check: 'planjob', file, detail });
  if (files.includes('server/worker.ts') && !/export\s+class\s+PlanJob\b/.test(read(root, 'server/worker.ts'))) {
    bad('server/worker.ts', 'does not export class PlanJob');
  }
  if (files.includes('wrangler.jsonc')) {
    const cfg = read(root, 'wrangler.jsonc').replace(/^\s*\/\/.*$/gm, '');
    if (!new RegExp(`"name"\\s*:\\s*"${BINDING}"\\s*,\\s*"class_name"\\s*:\\s*"PlanJob"`).test(cfg)) {
      bad('wrangler.jsonc', `does not bind PlanJob as ${BINDING}`);
    }
    if (!new RegExp(`"tag"\\s*:\\s*"${TAG}"[^}]*"new_sqlite_classes"\\s*:\\s*\\[[^\\]]*"PlanJob"`).test(cfg)) {
      bad('wrangler.jsonc', `has no migration ${TAG} creating PlanJob`);
    }
    if (/deleted_classes/.test(cfg)) bad('wrangler.jsonc', 'deletes a Durable Object class');
  }
  return out;
}
