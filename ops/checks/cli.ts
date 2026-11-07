// node ops/checks/cli.ts [--root <repo>] [--base <git ref>]: runs every custom check, prints findings, exits 1 on any.
// The trailer check needs a base: origin/$GITHUB_BASE_REF in a pull request, else origin/main when that ref exists
// (a builder's precheck), else it is skipped.
import { spawnSync } from 'node:child_process';
import { checkAccount } from './account.ts';
import { checkChartEv4 } from './chartev4.ts';
import { checkCompatImport } from './compatimport.ts';
import { checkDocsWrite } from './docswrite.ts';
import { checkEv4Word } from './ev4word.ts';
import { checkOldShapes } from './oldshapes.ts';
import { checkRestoreKind } from './restorekind.ts';
import { checkSubjectWords } from './subjectwords.ts';
import { checkIds } from './ids.ts';
import { checkHandover } from './handover.ts';
import { listFiles } from './lib.ts';
import { checkMigrationNames } from './migrationnames.ts';
import { checkMigrationShape } from './migrationshape.ts';
import { checkModelsAge } from './models.ts';
import { checkPlanJob } from './planjob.ts';
import { checkPresence } from './presence.ts';
import { checkRules } from './rules.ts';
import { checkSecrets } from './secrets.ts';
import { checkSourceIds } from './sourceids.ts';
import { checkStack } from './stack.ts';
import { checkTestRuns } from './testruns.ts';
import { checkTokens } from './tokens.ts';
import { checkUnusedExports } from './unusedexports.ts';
import { branchCommits, checkTrailers } from './trailer.ts';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const root = arg('root') ?? new URL('../..', import.meta.url).pathname;
const hasRef = (ref: string): boolean =>
  spawnSync('git', ['-C', root, 'rev-parse', '--verify', '-q', ref], { stdio: 'ignore' }).status === 0;
const base =
  arg('base') ??
  (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : hasRef('origin/main') ? 'origin/main' : undefined);
const files = listFiles(root);
const findings = [
  ...checkAccount(root, files),
  ...checkChartEv4(root, files),
  ...checkCompatImport(root, files),
  ...checkDocsWrite(root, files),
  ...checkEv4Word(root, files),
  ...checkOldShapes(root, files),
  ...checkHandover(root, files),
  ...checkIds(root, files),
  ...checkMigrationNames(files),
  ...checkMigrationShape(root, files),
  ...checkPlanJob(root, files),
  ...checkPresence(root, files),
  ...checkRestoreKind(root, files),
  ...checkRules(root, files),
  ...checkSecrets(root, files),
  ...checkSourceIds(root, files),
  ...checkStack(root, files),
  ...checkSubjectWords(root, files),
  ...checkTestRuns(root, files),
  ...checkTokens(root, files),
  ...checkUnusedExports(root),
  ...checkTrailers(branchCommits(root, base)),
];
for (const w of checkModelsAge(root)) console.log(`warning: ${w}`);
for (const f of findings) console.log(`${f.check}: ${f.file}: ${f.detail}`);
console.log(findings.length ? `${findings.length} finding(s)` : `checks ok${base ? '' : ' (trailer skipped: no base)'}`);
process.exit(findings.length ? 1 : 0);
