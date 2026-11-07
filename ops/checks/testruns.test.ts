import assert from 'node:assert/strict';
import { test } from 'vitest';
import { checkTestRuns, nodeCollects } from './testruns.ts';

test('node --test folders and globs collect test files', () => {
  const script = 'node --test ops/record/ data/tables/*.test.ts jobs/*/*.test.ts';
  assert.ok(nodeCollects(script, 'ops/record/a/b.test.ts'));
  assert.ok(nodeCollects(script, 'data/tables/tables.test.ts'));
  assert.ok(!nodeCollects(script, 'data/tables/deep/x.test.ts'));
  assert.ok(!nodeCollects(script, 'jobs/a/b/c.test.ts'));
});

test('a repo without package.json is skipped', () => {
  assert.deepEqual(checkTestRuns('/nowhere', ['x/y.test.ts']), []);
});
