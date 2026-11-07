import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import stylelint from 'stylelint';
import config from '../../stylelint.config.js';
import { listFiles } from './lib.ts';
import { checkTokens } from './tokens.ts';

function repo(files: Record<string, string>): { root: string; files: string[] } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tokens-'));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  return { root, files: listFiles(root) };
}

test('tokens: a var(--x) with no definition is found; kit tokens and local properties pass', () => {
  const r = repo({
    'kit/tokens/tokens.css': ':root { --sp-4: 16px; --ease: ease; }',
    'areas/a/a.css': '.a { gap: var(--sp-5); transition: opacity 1s var(--ease); width: var(--w, 1px); --w: 2px; }',
    'areas/b/b.css': '.b { gap: var(--sp-4, 0); /* var(--nope) */ }',
    'kit/components/M/M.css': '.m { flex: var(--part) 1 0; }',
    'kit/components/M/M.tsx': 'const s = { "--part": 1 };',
  });
  const found = checkTokens(r.root, r.files);
  assert.deepEqual(found.map(f => `${f.file} ${f.detail}`), ['areas/a/a.css --sp-5 is not defined in kit/tokens/tokens.css']);
});

test('stylelint: var(--ease) passes, raw easing values are refused', async () => {
  const lint = async (decl: string): Promise<number> =>
    (await stylelint.lint({ code: `.a { ${decl} }`, codeFilename: 'x.css', config })).results[0]?.warnings.length ?? -1;
  assert.equal(await lint('transition: opacity var(--dur) var(--ease);'), 0);
  for (const bad of [
    'transition: opacity var(--dur) ease;',
    'transition: opacity var(--dur) ease-in-out;',
    'transition-timing-function: linear;',
    'transition: opacity var(--dur) cubic-bezier(0,0,1,1);',
    'transition: opacity 200ms var(--ease);',
  ])
    assert.ok((await lint(bad)) > 0, bad);
});
