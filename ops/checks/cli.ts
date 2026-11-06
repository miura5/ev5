// node ops/checks/cli.ts [--root <repo>] [--base <git ref>]: runs every custom check, prints findings, exits 1 on any.
// The trailer check needs a base (defaults to origin/$GITHUB_BASE_REF in a pull request, otherwise it is skipped).
import { checkAccount } from './account.ts';
import { checkChartEv4 } from './chartev4.ts';
import { checkControls } from './controls.ts';
import { checkDocsKinds } from './docskinds.ts';
import { checkIds } from './ids.ts';
import { checkHandover } from './handover.ts';
import { listFiles } from './lib.ts';
import { checkModelsAge } from './models.ts';
import { checkPlanJob } from './planjob.ts';
import { checkPresence } from './presence.ts';
import { checkRadix } from './radix.ts';
import { checkRegistry } from './registry.ts';
import { checkRules } from './rules.ts';
import { checkSecrets } from './secrets.ts';
import { checkServerWrites } from './serverwrites.ts';
import { checkSourceIds } from './sourceids.ts';
import { checkStack } from './stack.ts';
import { checkUnusedExports } from './unusedexports.ts';
import { branchCommits, checkTrailers } from './trailer.ts';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const root = arg('root') ?? new URL('../..', import.meta.url).pathname;
const base = arg('base') ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined);
const files = listFiles(root);
const findings = [
  ...checkAccount(root, files),
  ...checkChartEv4(root, files),
  ...checkControls(root, files),
  ...checkDocsKinds(root, files),
  ...checkHandover(root, files),
  ...checkIds(root, files),
  ...checkPlanJob(root, files),
  ...checkPresence(root, files),
  ...checkRadix(root, files),
  ...checkRegistry(root, files),
  ...checkRules(root, files),
  ...checkSecrets(root, files),
  ...checkServerWrites(root, files),
  ...checkSourceIds(root, files),
  ...checkStack(root, files),
  ...checkUnusedExports(root),
  ...checkTrailers(branchCommits(root, base)),
];
for (const w of checkModelsAge(root)) console.log(`warning: ${w}`);
for (const f of findings) console.log(`${f.check}: ${f.file}: ${f.detail}`);
console.log(findings.length ? `${findings.length} finding(s)` : `checks ok${base ? '' : ' (trailer skipped: no base)'}`);
process.exit(findings.length ? 1 : 0);
