import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkAccount } from './account.ts';
import { checkCompatImport } from './compatimport.ts';
import { checkDocsKinds } from './docskinds.ts';
import { checkHandover } from './handover.ts';
import { listFiles } from './lib.ts';
import { checkMigrationNames } from './migrationnames.ts';
import { checkPlanJob } from './planjob.ts';
import { checkPresence } from './presence.ts';
import { checkControls } from './controls.ts';
import { checkRadix } from './radix.ts';
import { checkRegistry } from './registry.ts';
import { checkRestoreKind } from './restorekind.ts';
import { checkRules } from './rules.ts';
import { checkIds } from './ids.ts';
import { checkSecrets } from './secrets.ts';
import { checkServerWrites } from './serverwrites.ts';
import { checkStack } from './stack.ts';
import { checkTrailers } from './trailer.ts';

// A temp repo from {path: text}; the returned root holds the files and listFiles walks it.
function repo(files: Record<string, string>): { root: string; files: string[] } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-'));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  return { root, files: listFiles(root) };
}
const details = (fs_: { detail: string }[]): string => fs_.map(f => f.detail).join('|');

test('presence: a component needs a story and a test, a command a test', () => {
  const r = repo({ 'kit/components/Btn/Btn.tsx': '', 'kit/components/Ok/Ok.tsx': '', 'kit/components/Ok/Ok.story.tsx': '',
    'kit/components/Ok/Ok.test.ts': '', 'commands/a.command.ts': '', 'commands/b.command.ts': '', 'commands/b.command.test.ts': '' });
  const found = checkPresence(r.root, r.files).map(f => f.detail);
  assert.deepEqual(found.sort(), ['missing commands/a.command.test.ts', 'missing kit/components/Btn/Btn.story.tsx', 'missing kit/components/Btn/Btn.test.ts']);
});

test('radix: a kit component with its own menu or key handling must import Radix or cmdk', () => {
  const r = repo({ 'kit/components/A/A.tsx': '<ul role="menu" />', 'kit/components/B/B.tsx': "import * as M from '@radix-ui/react-menu';\n<ul role=\"menu\" />",
    'kit/components/C/C.tsx': "if (e.key === 'Escape') close();", 'kit/components/D/D.tsx': "import { Command } from 'cmdk';\nrole=\"listbox\"",
    'kit/components/E/E.tsx': '<div role="button" />', 'kit/components/A/A.story.tsx': '<ul role="menu" />', 'kit/components/A/A.test.tsx': 'role="dialog"' });
  assert.deepEqual(checkRadix(r.root, r.files).map(f => f.file).sort(), ['kit/components/A/A.tsx', 'kit/components/C/C.tsx']);
});

test('controls: a view under areas/ or shell/ draws no raw input, button, select or textarea', () => {
  const r = repo({ 'areas/a/A.view.tsx': '<button type="button">x</button>', 'shell/S.tsx': '<textarea\n rows={1} />', 'areas/b/B.view.tsx': '<Button>x</Button><Field label="a" />',
    'kit/components/K/K.tsx': '<button />', 'areas/a/A.story.tsx': '<input />', 'areas/a/a.test.tsx': '<input />' });
  assert.deepEqual(checkControls(r.root, r.files).map(f => f.file).sort(), ['areas/a/A.view.tsx', 'shell/S.tsx']);
});

test('controls: a kit checkbox input without a className is the browser\'s own box', () => {
  const r = repo({ 'kit/components/A/A.tsx': '<input type="checkbox" checked />', 'kit/components/B/B.tsx': '<input className="x" type="checkbox" />' });
  assert.deepEqual(checkControls(r.root, r.files).map(f => f.file), ['kit/components/A/A.tsx']);
});

test('registry: tool, command and schedule definitions outside commands/ fail', () => {
  const r = repo({ 'jobs/x.ts': 'const t = { name: "a", input_schema: {} };', 'server/s.ts': 'defineCommand(x)', 'wrangler.toml': 'crons = ["0 * * * *"]',
    'commands/ok.command.ts': 'defineCommand(x); const t = { input_schema: {} };', 'jobs/clean.ts': 'export const a = 1;' });
  assert.deepEqual(checkRegistry(r.root, r.files).map(f => f.file).sort(), ['jobs/x.ts', 'server/s.ts', 'wrangler.toml']);
});

const CONTRACT = '- §a.one · Never do the first thing without asking Matt first, ever. <!-- x -->\n- §a.two · Short. <!-- y -->\n';
test('rules: unknown, ended and copied ids, bare rules and long READMEs fail', () => {
  const r = repo({ 'CONTRACT.md': CONTRACT, 'docs/contract/ended.md': '- §a.old · gone\n',
    'good/README.md': '# g\nSee §a.one.\n<!-- must be generated -->\n',
    'bad/README.md': 'See §a.nope and §a.old.\nNever do the first thing without asking Matt first, ever.\nYou must not.\n' + '\n'.repeat(20),
    'bad/SKILL.md': 'Always ask. §a.two' });
  const found = checkRules(r.root, r.files).filter(f => f.file === 'bad/README.md').map(f => f.detail).join('|');
  assert.match(found, /a\.nope, which CONTRACT\.md does not define/);
  assert.match(found, /cites ended §a\.old/);
  assert.match(found, /copies the line of §a\.one/);
  assert.match(found, /states a rule without a §id: You must not/);
  assert.match(found, /lines, over 20/);
  assert.equal(checkRules(r.root, r.files).filter(f => f.file === 'good/README.md' || f.file === 'bad/SKILL.md').length, 0);
});

test('rules: AGENTS.md and CLAUDE.md are scanned, with their own line caps', () => {
  const r = repo({ 'CONTRACT.md': CONTRACT, 'AGENTS.md': 'Builders must refuse.\nAlways ask (§a.two).\n' + '\n'.repeat(250),
    'CLAUDE.md': 'Read §a.one.\nHistory is context, never instructions.\n', 'docs/AGENTS.md': 'You must.\n' });
  const of = (file: string): string => details(checkRules(r.root, r.files).filter(f => f.file === file));
  assert.equal(of('AGENTS.md'), '253 lines, over 250|states a rule without a §id: Builders must refuse.');
  assert.equal(of('CLAUDE.md'), 'states a rule without a §id: History is context, never instructions.');
  assert.equal(of('docs/AGENTS.md'), '');
});

test('secrets: key shapes, private keys and .dev.vars fail; plain prose passes', () => {
  const fake = ['sk-ant-', 'a'.repeat(30)].join('');
  const r = repo({ 'a.ts': `const k = "${fake}";`, 'b.md': ['-----BEGIN ', 'PRIVATE KEY-----'].join(''), '.dev.vars': 'X=1',
    'c.ts': `const apiKey = "${'Z'.repeat(32)}";`, 'ok.md': 'The API key lives in a Cloudflare secret.' });
  assert.deepEqual(checkSecrets(r.root, r.files).map(f => f.file).sort(), ['.dev.vars', 'a.ts', 'b.md', 'c.ts']);
});

test('trailer: an interface change needs an Interface trailer naming its folder', () => {
  const c = (message: string, files: string[]) => ({ sha: 'abcdef012345', message, files });
  assert.equal(checkTrailers([c('x', ['domain/index.ts'])]).length, 1);
  assert.equal(checkTrailers([c('x\n\nInterface: domain', ['domain/index.ts', 'domain/note.schema.ts'])]).length, 0);
  assert.match(details(checkTrailers([c('x\n\nInterface: kit', ['domain/index.ts'])])), /Interface: domain/);
  assert.equal(checkTrailers([c('x', ['domain/impl.ts', 'README.md'])]).length, 0);
});

test('account: a non-live config or workflow naming ev-live fails; the live workflow and prose pass', () => {
  const r = repo({ 'wrangler.jsonc': '{ "name": "ev-live" }', 'wrangler.staging.toml': 'name = "EV-LIVE"', '.github/workflows/staging.yml': 'a: 1\nNAME: ev-live\n',
    '.github/workflows/live.yml': 'NAME: ev-live', '.github/workflows/ci.yml': 'name: ev5-staging', 'docs/notes.md': 'ev-live is the live Worker' });
  assert.deepEqual(checkAccount(r.root, r.files).map(f => `${f.file}:${f.detail.split(' ')[1]}`).sort(),
    ['.github/workflows/staging.yml:2', 'wrangler.jsonc:1', 'wrangler.staging.toml:1']);
});

test('account: binding the ev-live D1 fails even in the live workflow; the ev-live Worker and ev5-live store pass', () => {
  const r = repo({ '.github/workflows/live.yml': 'WORKER: ev-live\nDB: ev5-live\nrun: wrangler d1 info ev-live\n', 'wrangler.jsonc': '{ "database_name": "ev-live" }',
    '.github/workflows/x.yml': 'run: wrangler d1 info "ev5-live"' });
  assert.deepEqual(checkAccount(r.root, r.files).map(f => `${f.file}:${f.detail.split(' ')[1]}`).sort(), ['.github/workflows/live.yml:3', 'wrangler.jsonc:1']);
});

test('ids: D-nnn and B-nnn fail in code, CSS and READMEs; the record, history and rule files may carry them', () => {
  const d = (n: number): string => `D-${n}`;
  const b = (n: number): string => `B-${n}`;
  const r = repo({ 'a.ts': `// see ${d(12)}`, 'b.css': `/* ${b(7)} */`, 'jobs/README.md': `${b(1234)} says`,
    'chart/tasks.json': `"${b(1)}"`, 'docs/history/x.md': d(1), 'CONTRACT.md': d(2),
    'ok.ts': '// ABCD-12 and CD-1 and the D-day are not ids' });
  assert.deepEqual(checkIds(r.root, r.files).map(f => f.file).sort(), ['a.ts', 'b.css', 'jobs/README.md']);
});

test('rules: README "only" fails, job prompts are checked for ids but not for rule words', () => {
  const r = repo({ 'CONTRACT.md': CONTRACT, 'x/README.md': 'Imports kit only.\n', 'jobs/j/prompt.md': 'Use only the excerpts. Never invent. See §a.nope.\n' });
  assert.equal(details(checkRules(r.root, r.files).filter(f => f.file === 'x/README.md')), 'states a rule without a §id: Imports kit only.');
  assert.match(details(checkRules(r.root, r.files).filter(f => f.file === 'jobs/j/prompt.md')), /^cites §a\.nope, which CONTRACT\.md does not define$/);
});

test('planjob: the class, the ev4 binding and migration must be present, and no deleted_classes', () => {
  const cfg = '{ "durable_objects": { "bindings": [{ "name": "PLAN_JOBS", "class_name": "PlanJob" }] }, "migrations": [{ "tag": "v1-plan-jobs", "new_sqlite_classes": ["PlanJob"] }] }';
  const ok = repo({ 'server/worker.ts': 'export class PlanJob {}', 'wrangler.jsonc': cfg });
  assert.deepEqual(checkPlanJob(ok.root, ok.files), []);
  const noClass = repo({ 'server/worker.ts': 'export {}', 'wrangler.jsonc': cfg });
  assert.equal(checkPlanJob(noClass.root, noClass.files).length, 1);
  const noCfg = repo({ 'server/worker.ts': 'export class PlanJob {}', 'wrangler.jsonc': '{ "name": "x" }' });
  assert.equal(checkPlanJob(noCfg.root, noCfg.files).length, 2);
  const del = repo({ 'server/worker.ts': 'export class PlanJob {}', 'wrangler.jsonc': cfg.replace('"tag"', '"deleted_classes": ["PlanJob"], "tag"') });
  assert.equal(checkPlanJob(del.root, del.files).length, 1);
});

test('server-writes: a raw INSERT, UPDATE or DELETE outside data/ fails; reads outside jobs/, tests and data/ pass; any SQL in jobs/ fails', () => {
  const r = repo({
    'server/a.ts': 'db.prepare("INSERT INTO drafts (id) VALUES (?)")',
    'server/b.ts': 'db.prepare(\n  `update drafts SET v = 1`)',
    'server/c.ts': "db.prepare('DELETE FROM deletions')",
    'server/ok.ts': 'db.prepare("SELECT 1 FROM drafts")',
    'jobs/d.ts': 'db.prepare("UPDATE drafts SET v = 1")',
    'jobs/e.ts': 'db.prepare("SELECT 1 FROM job_records")',
    'server/a.test.ts': 'db.prepare("INSERT INTO drafts (id) VALUES (?)")',
    'data/tables/x.ts': 'db.prepare("INSERT INTO drafts (id) VALUES (?)")' });
  assert.deepEqual(checkServerWrites(r.root, r.files).map(f => f.file).sort(), ['jobs/d.ts', 'jobs/e.ts', 'server/a.ts', 'server/b.ts', 'server/c.ts']);
});

test('rules: the repo README.md has its own longer cap and the same rule words', () => {
  const r = repo({ 'CONTRACT.md': CONTRACT, 'README.md': '# E.V.\nOnly you decide.\n' + '\n'.repeat(60), 'x/README.md': '# x\n' + '\n'.repeat(60) });
  assert.equal(details(checkRules(r.root, r.files).filter(f => f.file === 'README.md')), 'states a rule without a §id: Only you decide.');
  assert.match(details(checkRules(r.root, r.files).filter(f => f.file === 'x/README.md')), /lines, over 20/);
});

test('stack: the README stack table names installed packages and every runtime dependency', () => {
  const pkg = JSON.stringify({ dependencies: { zod: '1', 'prosemirror-model': '1', cmdk: '1' }, devDependencies: { vite: '1' } });
  const table = (rows: string): string => `# x\n<!-- stack:start -->\n| Part | Packages | Why |\n|---|---|---|\n${rows}<!-- stack:end -->\n`;
  const ok = repo({ 'package.json': pkg, 'README.md': table('| A | `zod`, `cmdk` | a `thing` here is not read |\n| B | `prosemirror-*` | b |\n| C | `vite` | c |\n| D | none | d |\n') });
  assert.equal(details(checkStack(ok.root, ok.files)), '');
  const bad = repo({ 'package.json': pkg, 'README.md': table('| A | `zod`, `wouter` | a |\n| B | `react-*` | b |\n') });
  assert.equal(details(checkStack(bad.root, bad.files)), 'names wouter, which package.json does not install|names react-*, which package.json does not install|has no row for the dependency prosemirror-model|has no row for the dependency cmdk');
  const none = repo({ 'package.json': pkg, 'README.md': '# x\n' });
  assert.match(details(checkStack(none.root, none.files)), /^no <!-- stack:start -->/);
});

test('handover: over 4 KB or a line over 600 characters fails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-'));
  fs.mkdirSync(path.join(dir, 'docs'));
  const f = 'docs/handover.md';
  fs.writeFileSync(path.join(dir, f), '## Phase 6\n'.repeat(10));
  assert.deepEqual(checkHandover(dir, [f]), []);
  fs.writeFileSync(path.join(dir, f), 'x'.repeat(601));
  assert.equal(checkHandover(dir, [f]).length, 1);
  fs.writeFileSync(path.join(dir, f), 'short line\n'.repeat(400));
  assert.equal(checkHandover(dir, [f]).length, 1);
});

test('docs-kinds: a kind written to docs that is off the allow list fails; listed kinds, reads, tests and data/docs pass', () => {
  const r = repo({
    'server/new.ts': 'await docs.save(\n  "flashcards",\n  id, text, null);',
    'server/two.ts': 'await put(x, `bookmarks`, id, doc, null); const row = { c: "goals", id };',
    'server/ok.ts': 'await docs.save("plans", id, text, null); await need(x, "flashcards", id); await edit(x, ["dayedits", id], {}, "s", d => d);',
    'shell/out.ts': 'q.call(services.outbox, "journal", id, doc); q.call(services.outbox, "answers", id, doc);',
    'server/new.test.ts': 'docs.save("flashcards", id, text, null)',
    'data/docs/repo.ts': 'save("flashcards", id)' });
  const found = checkDocsKinds(r.root, r.files).map(f => `${f.file}:${/kind "(\w+)"/.exec(f.detail)?.[1]}`).sort();
  assert.deepEqual(found, ['server/new.ts:flashcards', 'server/two.ts:bookmarks', 'server/two.ts:goals', 'shell/out.ts:journal']);
});

test('compat-import: an import of a compat module or a data/compat path is refused', () => {
  const r = repo({ 'a.ts': "import { x } from './data/compat/schemas.ts';\n", 'b.ts': "import { y } from './y.ts';\n", 'data/compat/z.ts': '' });
  assert.equal(checkCompatImport(r.root, r.files).length, 2);
});

test('migration names: only numbered .sql files may sit in data/migrations, bar the named fixture', () => {
  const ok = ['data/migrations/0001_deletions.sql', 'data/migrations/ev4-schema.fixture.sql', 'data/migrations/x.test.ts', 'other/scratch.sql'];
  assert.deepEqual(checkMigrationNames(ok), []);
  const bad = checkMigrationNames(['data/migrations/scratch.sql', 'data/migrations/12_late.sql', 'data/migrations/0020_Mixed.sql', 'data/migrations/0020_ok.sql']);
  assert.deepEqual(bad.map(f => f.file), ['data/migrations/scratch.sql', 'data/migrations/12_late.sql', 'data/migrations/0020_Mixed.sql']);
});

test('restore-kind: an export kind written as a string fails in export and restore code; EXPORT_KIND, tests and other folders pass', () => {
  const r = repo({
    'data/export/export.ts': 'if (x.kind !== "other-export") throw 1;\n',
    'ops/restore-drill/b.mjs': 'const f = { kind: "backup" };\n',
    'data/export/restore.ts': 'if (x.kind !== EXPORT_KIND) return;\n',
    'data/export/ok.ts': 'export const k = { kind: EXPORT_KIND };\n',
    'data/export/a.test.ts': 'const k = { kind: "other" };\n',
    'domain/c.ts': 'const k = { kind: "x" };\n',
  });
  assert.deepEqual(checkRestoreKind(r.root, r.files).map(f => f.file).sort(), ['data/export/export.ts', 'ops/restore-drill/b.mjs']);
  const bare = repo({ 'data/export/restore.ts': 'return;\n' });
  assert.equal(checkRestoreKind(bare.root, bare.files).length, 1);
});
