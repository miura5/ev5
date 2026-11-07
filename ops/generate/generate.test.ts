import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { generate, write } from './lib.ts';

const CLI = new URL('./cli.ts', import.meta.url).pathname;
const FILES: Record<string, string> = {
  '.dependency-cruiser.cjs': `module.exports = { forbidden: [{ name: 'areas-imports', to: { pathNot: ['^areas/', '^kit/'] } }] };`,
  'areas/a/area.ts': 'export const aArea = { id: "a" } as const;',
  'areas/README.md': '# areas/\n\n<!-- interface and must-not lines are generated (S-13) -->\n',
  'commands/x.command.ts': "export const x = [defineCommand({ name: 'x' })];",
  'commands/README.md': '# commands/\n\n<!-- generated:start -->\nold\n<!-- generated:end -->\n',
};
function repo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-'));
  for (const [f, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  return root;
}
const check = (root: string) => spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', CLI, '--check', '--root', root], { encoding: 'utf8' });

test('output is deterministic and carries the interface', () => {
  const root = repo();
  const first = generate(root);
  assert.deepEqual([...generate(root)], [...first]);
  assert.match(first.get('areas/registry.generated.ts')!, /import \{ aArea \} from "\.\/a\/area\.ts"/);
  assert.match(first.get('commands/client.ts')!, /"x"/);
  assert.match(first.get('areas/README.md')!, /Interface: area a\n<!-- generated:end -->/);
  assert.doesNotMatch(first.get('areas/README.md')!, /Imports:/);
  assert.match(first.get('commands/README.md')!, /Interface: x\.command\.ts/);
});

test('check fails on a stale file and passes when fresh', () => {
  const root = repo();
  const stale = check(root);
  assert.equal(stale.status, 1);
  assert.match(stale.stdout, /stale: commands\/client\.ts/);
  write(root, generate(root));
  assert.equal(check(root).status, 0);
  fs.appendFileSync(path.join(root, 'commands/client.ts'), '// edited\n');
  assert.equal(check(root).status, 1);
  execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', CLI, '--root', root]);
  assert.equal(check(root).status, 0);
});
