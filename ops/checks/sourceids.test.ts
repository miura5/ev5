import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { checkSourceIds } from './sourceids.ts';

test('source-ids: a cited id that is ended or not in CONTRACT fails; live ids and tests pass', () => {
  const files: Record<string, string> = {
    'CONTRACT.md': '# Contract\n\n## Drift\n\n- §drift.live · A live rule.\n- §drift.gone · A rule that ended.\n',
    'docs/contract/ended.md': '# Ended\n\n| id | rule |\n|---|---|\n| §drift.gone | x |\n',
    'domain/ok.ts': '// §drift.live\n',
    'domain/ended.ts': '// §drift.gone\n',
    'domain/missing.ts': '// ok\n// §drift.nothere\n',
    'domain/a.test.ts': '// §drift.nothere\n',
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-'));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  const found = checkSourceIds(root, Object.keys(files));
  assert.deepEqual(found.map(f => f.file).sort(), ['domain/ended.ts', 'domain/missing.ts']);
  assert.match(found.find(f => f.file === 'domain/ended.ts')!.detail, /ended/);
  assert.match(found.find(f => f.file === 'domain/missing.ts')!.detail, /line 2 .*not defined/);
});
