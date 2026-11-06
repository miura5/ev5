// task delete against a scratch copy of the carried ev4 Chart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChart } from './chart.ts';
import { main } from './cli.ts';
import { lintChart } from './lint.ts';

const CARRIED = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures-ev4');
const NOW = '2026-11-03T15:00:00.000Z';

function scratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev5-record-'));
  fs.cpSync(path.join(CARRIED, 'chart'), path.join(dir, 'chart'), { recursive: true });
  return dir;
}
function run(dir: string, ...argv: string[]): { code: number; out: string } {
  const lines: string[] = [];
  const code = main([...argv, '--root', dir, '--now', NOW], s => lines.push(s), s => lines.push(s), () => true);
  return { code, out: lines.join('\n') };
}
const errorCount = (dir: string): number =>
  lintChart(loadChart(dir)).filter(f => f.level === 'error' && f.check !== 'bad-milestone').length;

test('task delete needs a decision, keeps the highest id, and refuses a task still named', () => {
  const dir = scratch();
  run(dir, 'task', 'add', '--title', 'One', '--milestone', 'Phase 1');
  run(dir, 'task', 'add', '--title', 'Two', '--milestone', 'Phase 1', '--depends', 'B-691');
  const d = run(dir, 'decision', 'add', '--title', 'Drop them', '--why', 'w').out.match(/D-\d+/)?.[0] ?? '';
  assert.equal(run(dir, 'task', 'delete', 'B-691').code, 1, 'needs --decision');
  assert.equal(run(dir, 'task', 'delete', 'B-691', '--decision', d).code, 1, 'B-692 still names it');
  assert.equal(run(dir, 'task', 'delete', 'B-692', '--decision', d).code, 1, 'the highest id stays');
  run(dir, 'task', 'add', '--title', 'Three', '--milestone', 'Phase 1');
  assert.equal(run(dir, 'task', 'delete', 'B-691,B-692', '--decision', d).code, 0);
  assert.deepEqual(
    loadChart(dir).tasks.slice(-1).map(x => x.id),
    ['B-693'],
  );
  assert.match(run(dir, 'task', 'add', '--title', 'Four', '--milestone', 'Phase 1').out, /^B-694/);
  assert.equal(errorCount(dir), 0);
  assert.equal(run(dir, 'render', '--check').code, 0);
});
