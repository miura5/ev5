import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkChartEv4 } from './chartev4.ts';

test('chart-paths: an open task whose done bar names an old-app path fails; done tasks and v5 paths pass', () => {
  const tasks = [
    { id: 't1', status: 'open', dod: 'tools/chart.mjs prints it' },
    { id: 't2', status: 'blocked', dod: 'matches spec.registry' },
    { id: 't3', status: 'done', dod: 'pwa/index.html' },
    { id: 't4', status: 'open', dod: 'server/x.ts and ops/tools/y pass' },
  ];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'checks-'));
  fs.mkdirSync(path.join(root, 'chart'));
  fs.writeFileSync(path.join(root, 'chart/tasks.json'), JSON.stringify({ tasks }));
  const found = checkChartEv4(root, ['chart/tasks.json']);
  assert.equal(found.length, 2);
  assert.match(found[0]!.detail, /^t1: .*tools\/chart\.mjs/);
  assert.match(found[1]!.detail, /^t2: .*spec\.registry/);
});
