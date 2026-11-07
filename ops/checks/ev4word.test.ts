import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkEv4Word } from './ev4word.ts';

const word = ['ev', '4'].join('');

test('ev4-word: source naming the old app fails, outside the cutover files, tests and docs', () => {
  const files: Record<string, string> = {
    'domain/a.ts': `// from ${word}\n`,
    'domain/b.ts': `export const x = '${word.toUpperCase()}';\n`,
    'domain/c.ts': `export const evolve4 = 1; // ${word}s are not the word\n`,
    'domain/a.test.ts': `// ${word}\n`,
    'docs/x.md': word,
    'chart/tasks.json': word,
    'server/ev4-routes.ts': word,
    'ops/record/lint.ts': word,
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-'));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  const found = checkEv4Word(root, Object.keys(files));
  assert.deepEqual(found.map(f => f.file).sort(), ['domain/a.ts', 'domain/b.ts']);
  assert.match(found[0]!.detail, /line 1 names the old app/);
});
