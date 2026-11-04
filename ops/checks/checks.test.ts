import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkAccount } from './account.ts';
import { listFiles } from './lib.ts';
import { checkPresence } from './presence.ts';
import { checkRadix } from './radix.ts';
import { checkRegistry } from './registry.ts';
import { checkRules } from './rules.ts';
import { checkIds } from './ids.ts';
import { checkSecrets } from './secrets.ts';
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

test('ids: D-nnn and B-nnn fail in code, CSS and READMEs; the record, history and rule files may carry them', () => {
  const d = (n: number): string => `D-${n}`;
  const b = (n: number): string => `B-${n}`;
  const r = repo({ 'a.ts': `// see ${d(12)}`, 'b.css': `/* ${b(7)} */`, 'jobs/README.md': `${b(1234)} says`,
    'chart/tasks.json': `"${b(1)}"`, 'docs/history/x.md': d(1), 'CONTRACT.md': d(2), 'data/compat/x.json': d(3),
    'ok.ts': '// ABCD-12 and CD-1 and the D-day are not ids' });
  assert.deepEqual(checkIds(r.root, r.files).map(f => f.file).sort(), ['a.ts', 'b.css', 'jobs/README.md']);
});
