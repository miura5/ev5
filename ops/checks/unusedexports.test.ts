import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkUnusedExports } from './unusedexports.ts';

const here = path.resolve(import.meta.dirname, '../..');

function repo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unused-'));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  fs.mkdirSync(path.join(root, 'node_modules/.bin'), { recursive: true });
  fs.symlinkSync(path.join(here, 'node_modules/.bin/knip'), path.join(root, 'node_modules/.bin/knip'));
  fs.symlinkSync(path.join(here, 'node_modules/knip'), path.join(root, 'node_modules/knip'));
  return root;
}

const base = {
  'package.json': '{"name":"x","type":"module"}',
  'tsconfig.json': '{"compilerOptions":{"module":"esnext","moduleResolution":"bundler","allowImportingTsExtensions":true,"noEmit":true}}',
  'server/index.ts': "import { used } from '../domain/a.ts';\nconsole.log(used);\n",
  'domain/a.ts': "export const used = 1;\nexport const onlyTest = 2;\n",
  'domain/a.test.ts': "import { onlyTest } from './a.ts';\nconsole.log(onlyTest);\n",
};

test('unused-exports: an export only a test imports is found; an allow-listed folder passes; a stale entry is refused', () => {
  const cfg = (ignore: Record<string, string[]>): string =>
    JSON.stringify({ entry: ['server/index.ts!'], project: ['{domain,server}/**/*.ts!'], ignoreIssues: ignore });
  const red = repo({ ...base, 'knip.production.json': cfg({}) });
  const found = checkUnusedExports(red);
  assert.deepEqual(found.map(f => f.file), ['domain/a.ts']);
  assert.match(found[0]?.detail ?? '', /onlyTest/);

  const allowed = repo({ ...base, 'knip.production.json': cfg({ 'domain/**': ['exports'] }) });
  assert.deepEqual(checkUnusedExports(allowed), []);

  const stale = repo({
    ...base,
    'domain/a.test.ts': '',
    'domain/a.ts': 'export const used = 1;\n',
    'knip.production.json': cfg({ 'domain/**': ['exports'] }),
  });
  assert.match(checkUnusedExports(stale)[0]?.detail ?? '', /remove the line/);
});
