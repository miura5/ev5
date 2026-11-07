import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { checkOldShapes } from './oldshapes.ts';

test('old-shapes: SQL on docs, an old collection name or the old envelope fails in non-test source only', () => {
  const files: Record<string, string> = {
    'data/a.ts': "db.prepare('SELECT * FROM docs WHERE id = ?');\n",
    'data/b.ts': "const kind = 'dayedits';\n",
    'data/c.ts': "const body = { source: 'v5-app', v: 1 };\n",
    'data/d.sql': 'CREATE TABLE IF NOT EXISTS docs (id TEXT);\n',
    'data/ok.ts': "// update docs for the new table\nconst answers = 1; const s = { schema: z };\n",
    'data/a.test.ts': "'SELECT * FROM docs'; 'answers'; ({ source: 'v5x' });\n",
    [`server/ev${4}-routes.ts`]: "'dayedits'\n",
    'chart/tasks.json': 'from docs',
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-'));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  const found = checkOldShapes(root, Object.keys(files));
  assert.deepEqual(found.map(f => f.file).sort(), ['data/a.ts', 'data/b.ts', 'data/c.ts', 'data/d.sql']);
  assert.match(found.find(f => f.file === 'data/a.ts')!.detail, /line 1 has SQL naming the docs table/);
});
