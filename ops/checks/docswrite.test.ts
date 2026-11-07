import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkDocsWrite } from './docswrite.ts';
import { checkRestoreKind } from './restorekind.ts';

function tree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-'));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  return root;
}

test('docs-write: a seed, e2e or staging script that PUTs /docs fails; commands, GETs and tests pass', () => {
  const files: Record<string, string> = {
    'data/staging/seed.ts': "await fetch(`${base}/api/v1/docs/goals/g1`, { method: 'PUT', body });\n",
    'e2e/helpers.ts': "await request.put('/docs/note/n1', { data });\n",
    '.github/workflows/staging.yml': '      - run: curl -X PUT "$URL/docs/goal/g1"\n',
    'e2e/ok.ts': "await request.post('/api/v1/commands/set-goal', { data });\nawait request.get('/docs/x');\n",
    'data/staging/seed.test.ts': "// nothing is PUT to /docs\nfetch('/docs/a', { method: 'PUT' });\n",
    'server/handlers.ts': "app.put('/docs/:kind', h);\n",
  };
  const found = checkDocsWrite(tree(files), Object.keys(files));
  assert.deepEqual(found.map(f => f.file).sort(), ['.github/workflows/staging.yml', 'data/staging/seed.ts', 'e2e/helpers.ts']);
  assert.match(found[0]!.detail, /line \d+ writes by PUT \/docs/);
});

test('restore-kind: a literal export kind or a restore without the EXPORT_KIND refusal fails', () => {
  const files: Record<string, string> = {
    'data/export/export.ts': "export const f = { kind: 'ev-export' };\n",
    'data/export/index.ts': 'export const g = { kind: EXPORT_KIND };\n',
    'data/export/restore.ts': "if (file.kind === 'other') throw new Error('x');\n",
    'data/export/restore.test.ts': "const k = { kind: 'ev4' };\n",
  };
  const found = checkRestoreKind(tree(files), Object.keys(files));
  assert.deepEqual(found.map(f => f.file).sort(), ['data/export/export.ts', 'data/export/restore.ts', 'data/export/restore.ts']);
  const good = { 'data/export/restore.ts': 'if (file.kind !== EXPORT_KIND) throw new Error(`x`);\n' };
  assert.deepEqual(checkRestoreKind(tree(good), Object.keys(good)), []);
});
