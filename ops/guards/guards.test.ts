// Each guard must fail when it should. For every guard this builds a small temp repo (the guard's own config copied
// from the real one, node_modules linked), proves the clean repo passes, adds one violation, runs the guard's real
// command and asserts a non-zero exit with the expected finding. Set GUARDS_SHOW=1 to print the red output.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const REAL = path.resolve(import.meta.dirname, '../..');
const CONFIGS = ['eslint.config.js', '.dependency-cruiser.cjs', 'stylelint.config.js', 'knip.json', 'knip.production.json', 'tsconfig.json', 'CONTRACT.md'];
const bin = (n: string): string => path.join(REAL, 'node_modules/.bin', n);
const strip = Number(process.versions.node.split('.')[0]) < 24 ? ['--experimental-strip-types'] : [];
const DIRS = ['areas', 'shell', 'kit', 'commands', 'jobs', 'domain', 'data', 'server', 'ops'];

type Files = Record<string, string>;
const CLEAN: Files = {
  'domain/ok.ts': 'export const ok = 1;\n',
  'domain/ok.test.ts': "import { ok } from './ok.ts';\nexport const t = ok;\n",
  'kit/ok.css': 'a { color: var(--ink); }\n',
  'domain/index.ts': "import { ok } from './ok.ts';\nexport const fromIndex = ok;\n",
  'server/index.ts': "import { fromIndex } from '../domain/index.ts';\nexport const s = fromIndex;\n",
};

// A temp repo: the real guard configs, linked node_modules, every folder the guards look in, then `files`.
function sandbox(files: Files): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guards-'));
  for (const c of CONFIGS) fs.copyFileSync(path.join(REAL, c), path.join(root, c));
  // The temp repo has none of the app, so its package.json declares no dependencies (knip would flag them all unused).
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"guards","private":true,"type":"module"}\n');
  // Nor does it have the app's test-only exports, so the real allow-list would read as stale.
  const kp = JSON.parse(fs.readFileSync(path.join(root, 'knip.production.json'), 'utf8')) as object;
  fs.writeFileSync(path.join(root, 'knip.production.json'), JSON.stringify({ ...kp, ignoreIssues: undefined }));
  fs.symlinkSync(path.join(REAL, 'node_modules'), path.join(root, 'node_modules'));
  for (const d of DIRS) fs.mkdirSync(path.join(root, d), { recursive: true });
  for (const [f, text] of Object.entries({ ...CLEAN, ...files })) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  return root;
}

function run(cwd: string, cmd: string, args: string[]): { code: number | null; out: string } {
  // NODE_TEST_CONTEXT: else a nested `node --test` thinks it is this run. GITHUB_BASE_REF: the temp repo has no git history.
  const { NODE_TEST_CONTEXT: _, GITHUB_BASE_REF: __, ...env } = process.env;
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

type Cmd = [string, string[]];
type Guard = { name: string; command: (root: string) => Cmd; files: Files; expect: RegExp };
const eslint = (): Cmd => [bin('eslint'), ['.', '--max-warnings', '0']];
const depcruise = (): Cmd => [bin('depcruise'), [...DIRS, '--config', '.dependency-cruiser.cjs']];
const stylelint = (): Cmd => [bin('stylelint'), ['**/*.css', '--allow-empty-input']];
const knip = (): Cmd => [bin('knip'), []];
const checks = (r: string): Cmd => [process.execPath, [...strip, path.join(REAL, 'ops/checks/cli.ts'), '--root', r]];

const lines301 = `${Array.from({ length: 300 }, (_, i) => `export const a${i} = ${i};`).join('\n')}\nexport const last = 1;\n`;
const GUARDS: Guard[] = [
  { name: 'a 301-line file (eslint max-lines)', command: eslint, files: { 'domain/long.ts': lines301 }, expect: /max-lines/ },
  { name: 'an inline eslint-disable (eslint noInlineConfig)', command: eslint, files: { 'domain/dis.ts': '// eslint-disable-next-line no-undef\nexport const x = 1;\n' }, expect: /eslint-disable/ },
  { name: 'a @ts-ignore comment (eslint no-warning-comments)', command: eslint, files: { 'domain/ts.ts': '// @ts-ignore\nexport const x = 1;\n' }, expect: /no-warning-comments/ },
  { name: 'an export * (eslint no-restricted-syntax)', command: eslint, files: { 'domain/star.ts': "export * from './ok.ts';\n" }, expect: /no-restricted-syntax/ },
  { name: 'a bad import, domain into data (dependency-cruiser)', command: depcruise, files: { 'data/index.ts': 'export const d = 1;\n', 'domain/bad.ts': "import { d } from '../data/index.ts';\nexport const b = d;\n" }, expect: /domain-imports/ },
  { name: 'toLocaleDateString in an area (eslint no-restricted-syntax)', command: eslint, files: { 'areas/x/d.ts': "export const d = (): string => new Date().toLocaleDateString('en-US');\n" }, expect: /domain\/time/ },
  { name: 'Intl.DateTimeFormat in an area (eslint no-restricted-syntax)', command: eslint, files: { 'areas/x/f.ts': "export const f = new Intl.DateTimeFormat('en-US');\n" }, expect: /domain\/time/ },
  { name: 'window.location.search in an area (eslint no-restricted-syntax)', command: eslint, files: { 'areas/x/l.ts': 'export const q = (): string => window.location.search;\n' }, expect: /wouter-only-in-shell/ },
  { name: 'window.history in an area (eslint no-restricted-syntax)', command: eslint, files: { 'areas/x/h.ts': 'export const b = (): void => window.history.back();\n' }, expect: /wouter-only-in-shell/ },
  { name: 'a cycle (dependency-cruiser no-cycles)', command: depcruise, files: { 'domain/a.ts': "import { b } from './b.ts';\nexport const a = (): unknown => b;\n", 'domain/b.ts': "import { a } from './a.ts';\nexport const b = (): unknown => a;\n" }, expect: /no-cycles/ },
  { name: 'a raw colour (stylelint)', command: stylelint, files: { 'kit/raw.css': 'a { color: #ff0000; }\n' }, expect: /color-no-hex|declaration-property-value-allowed-list/ },
  { name: 'an unused export (knip)', command: knip, files: { 'domain/dead.ts': 'export const used = 1;\nexport const unused = 2;\n', 'domain/dead.test.ts': "import { used } from './dead.ts';\nexport const t = used;\n" }, expect: /unused/i },
  { name: 'a job without job.test.ts (ops/checks presence)', command: checks, files: { 'jobs/solo/job.ts': 'export const solo = 1;\n' }, expect: /presence: jobs\/solo\/job\.ts: missing jobs\/solo\/job\.test\.ts/ },
  { name: 'a component without a story (ops/checks presence)', command: checks, files: { 'kit/components/Btn/Btn.tsx': 'export const Btn = 1;\n', 'kit/components/Btn/Btn.test.tsx': '' }, expect: /presence: kit\/components\/Btn: missing kit\/components\/Btn\/Btn\.story\.tsx/ },
  { name: 'a kit menu without Radix (ops/checks radix)', command: checks, files: { 'kit/components/Pop/Pop.tsx': 'export const Pop = () => <ul role="menu" />;\n' }, expect: /radix: kit\/components\/Pop\/Pop\.tsx: draws or handles role="menu itself; import @radix-ui\/\* or cmdk/ },
  { name: 'a raw button in a view (ops/checks controls)', command: checks, files: { 'areas/x/X.view.tsx': 'export const X = () => <button type="button">go</button>;\n' }, expect: /controls: areas\/x\/X\.view\.tsx: renders a raw <button>; use the kit component/ },
  { name: 'a decision id in a comment (ops/checks ids)', command: checks, files: { 'domain/why.ts': `// kept because of ${['D', '123'].join('-')}\nexport const why = 1;\n` }, expect: /ids: domain\/why\.ts: line 1 gives D.123/ },
  { name: 'a new kind written to the docs table (ops/checks docs-kinds)', command: checks, files: { 'server/flash.ts': 'await docs.save("flashcards", id, text, null);\n' }, expect: /docs-kinds: server\/flash\.ts: line 1 writes kind "flashcards" to the generic docs table/ },
  { name: 'an export only its test uses (ops/checks unused-exports)', command: checks, files: { 'domain/tested.ts': 'export const used = 1;\nexport const testOnly = 2;\n', 'domain/tested.test.ts': "import { used, testOnly } from './tested.ts';\nexport const t = used + testOnly;\n", 'domain/index.ts': "export { used } from './tested.ts';\n", 'server/index.ts': "import { used } from '../domain/index.ts';\nexport const s = used;\n" }, expect: /unused-exports: domain\/tested\.ts: line 2 exports testOnly, which only tests import/ },
  { name: 'a section id that CONTRACT does not define (ops/checks source-ids)', command: checks, files: { 'domain/cite.ts': '// see §nope.missing\nexport const cite = 1;\n' }, expect: /source-ids: domain\/cite\.ts: line 1 cites §nope\.missing, which is not defined in CONTRACT\.md/ },
  { name: 'a section id that has ended (ops/checks source-ids)', command: checks, files: { 'domain/old.ts': '// see §old.rule\nexport const old = 1;\n', 'CONTRACT.md': '- §old.rule · gone\n', 'docs/contract/ended.md': '- §old.rule · ended\n' }, expect: /source-ids: domain\/old\.ts: line 1 cites §old\.rule, which is ended/ },
  { name: 'an open task whose done bar names an old-app path (ops/checks chart-paths)', command: checks, files: { 'chart/tasks.json': '[{"id":"X-9","status":"open","dod":"npm test and tools/foo.mjs pass"}]\n' }, expect: /chart-paths: chart\/tasks\.json: X-9: the done bar names the old app's path "tools\/foo\.mjs"/ },
  { name: "the old app's name in source (ops/checks ev4-word)", command: checks, files: { 'domain/old.ts': `// copied from ${['ev', '4'].join('')}\nexport const old = 1;\n` }, expect: /ev4-word: domain\/old\.ts: line 1 names the old app/ },
  { name: 'a subject word in source (ops/checks subject-word)', command: checks, files: { 'domain/subject.ts': `// ${['nurs', 'ing'].join('')} notes\nexport const s = 1;\n` }, expect: /subject-word: domain\/subject\.ts: 1 line\(s\), first 1/ },
  { name: 'a restore that reads another export kind (ops/checks restore-kind)', command: checks, files: { 'data/export/export.ts': 'export const ok = (x: { kind: string }): boolean => x.kind === "backup-file";\n' }, expect: /restore-kind: data\/export\/export\.ts: line 1 writes an export kind as a string/ },
  { name: 'a table without kind id, at and v (ops/checks migration-shape)', command: checks, files: { 'data/migrations/0099_x.sql': 'CREATE TABLE IF NOT EXISTS widgets (\n  id TEXT PRIMARY KEY,\n  name TEXT\n);\n' }, expect: /migration-shape: data\/migrations\/0099_x\.sql: table widgets: id must be TEXT PRIMARY KEY CHECK/ },
  { name: 'a deletable table without deleted_at (ops/checks migration-shape)', command: checks, files: { 'data/migrations/0099_x.sql': "CREATE TABLE IF NOT EXISTS widgets (\n  id TEXT PRIMARY KEY CHECK (substr(id, 1, 4) = 'wid_'),\n  at INTEGER NOT NULL,\n  v INTEGER NOT NULL\n);\n" }, expect: /table widgets: missing column deleted_at/ },
  { name: 'an allow-list entry nothing needs (ops/checks unused-exports)', command: checks, files: { 'knip.production.json': JSON.stringify({ entry: ['server/index.ts!'], project: ['{domain,server}/**/*.ts!'], ignoreIssues: { 'domain/**': ['exports'] } }), 'domain/index.ts': "export { ok } from './ok.ts';\n", 'server/index.ts': "import { ok } from '../domain/index.ts';\nexport const s = ok;\n" }, expect: /unused-exports: knip\.production\.json: ignoreIssues entry domain\/\*\* has no test-only export left/ },
  { name: 'a table missing from the row-shapes test (ops/checks migration-shape)', command: checks, files: { 'data/migrations/row-shapes.test.ts': "// table: 'other'\n", 'data/migrations/0099_x.sql': "CREATE TABLE IF NOT EXISTS widgets (\n  id TEXT PRIMARY KEY CHECK (substr(id, 1, 4) = 'wid_'),\n  at INTEGER NOT NULL,\n  v INTEGER NOT NULL\n);\n" }, expect: /table widgets: not in data\/migrations\/row-shapes\.test\.ts/ },
  { name: 'an e2e journey that writes by PUT /docs (ops/checks docs-writes)', command: checks, files: { 'e2e/seed.journey.spec.ts': 'await api("PUT", "/api/v1/docs?collection=exams&id=x", {});\n' }, expect: /docs-writes: e2e\/seed\.journey\.spec\.ts: line 1 writes by PUT \/docs/ },
  { name: 'a tool defined outside the registry (ops/checks registry)', command: checks, files: { 'server/tool.ts': "export const t = { name: 'x', input_schema: {} };\n" }, expect: /registry: server\/tool\.ts: a Claude tool definition outside commands\// },
];

for (const g of GUARDS) {
  test(`red: ${g.name}`, () => {
    const clean = sandbox({});
    const base = run(clean, ...g.command(clean));
    assert.equal(base.code, 0, `the clean repo must pass first:\n${base.out}`);
    const root = sandbox(g.files);
    const r = run(root, ...g.command(root));
    if (process.env.GUARDS_SHOW) console.log(`--- ${g.name}\n${r.out.trim().slice(0, 600)}`);
    assert.notEqual(r.code, 0, `guard stayed green:\n${r.out}`);
    assert.match(r.out, g.expect);
  });
}

test('warn: a models.ts checked long ago prints a warning and still passes (ops/checks models)', () => {
  const models = (on: string): Files => ({ 'jobs/runtime/models.ts': `export const MODELS_CHECKED_ON = '${on}';\nconst MAX_AGE_DAYS = 90;\n` });
  const fresh = sandbox(models(new Date().toISOString().slice(0, 10)));
  const f = run(fresh, ...checks(fresh));
  assert.equal(f.code, 0, f.out);
  assert.doesNotMatch(f.out, /models:/);
  const root = sandbox(models('2020-01-01'));
  const r = run(root, ...checks(root));
  if (process.env.GUARDS_SHOW) console.log(`--- models\n${r.out.trim().slice(0, 600)}`);
  assert.equal(r.code, 0, `a stale date must warn, not fail:\n${r.out}`);
  assert.match(r.out, /warning: models: jobs\/runtime\/models\.ts: model ids and prices were last checked on 2020-01-01/);
});
