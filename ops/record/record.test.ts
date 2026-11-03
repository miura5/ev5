import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChart, saveChart, serialize } from './chart.ts';
import { main } from './cli.ts';
import { lintChart } from './lint.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const NOW = '2026-11-03T15:00:00.000Z';
/** ev4's Chart as carried (ev4 9d9af38); the live chart/ grows, this copy never does. */
const CARRIED = path.join(HERE, 'fixtures-ev4');

/** A scratch repo holding a copy of the carried Chart and its renders. */
function scratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev5-record-'));
  fs.cpSync(path.join(CARRIED, 'chart'), path.join(dir, 'chart'), { recursive: true });
  main(['render', '--root', dir, '--now', NOW], () => {}, () => {});
  return dir;
}
function run(dir: string, ...argv: string[]): { code: number; out: string } {
  const lines: string[] = [];
  const code = main([...argv, '--root', dir, '--now', NOW], s => lines.push(s), s => lines.push(s));
  return { code, out: lines.join('\n') };
}
const read = (dir: string, f: string): string => fs.readFileSync(path.join(dir, f), 'utf8');

test("load then save leaves every carried file byte-identical (ev4's indent 1, no trailing newline)", () => {
  const dir = scratch();
  const before = fs.readdirSync(path.join(dir, 'chart')).map(f => read(dir, 'chart/' + f));
  saveChart(dir, loadChart(dir));
  assert.deepEqual(
    fs.readdirSync(path.join(dir, 'chart')).map(f => read(dir, 'chart/' + f)),
    before
  );
  assert.ok(!read(dir, 'chart/tasks.json').endsWith('\n'));
  assert.equal(serialize({ a: [1] }), '{\n "a": [\n  1\n ]\n}');
});

test('the carried Chart files are byte-identical copies of ev4 when ev4 is present', t => {
  const ev4 = path.join(process.env.EV4_ROOT || path.resolve(ROOT, '..', 'ev4'), 'chart');
  if (!fs.existsSync(ev4)) return t.skip('no ev4 checkout (set EV4_ROOT)');
  for (const f of ['tasks', 'decisions', 'deploys', 'rules', 'views'])
    assert.equal(read(CARRIED, `chart/${f}.json`), fs.readFileSync(path.join(ev4, f + '.json'), 'utf8'), f);
});

test('task add takes the next id in the carried sequence, and the backlog shows it', () => {
  const dir = scratch();
  const r = run(dir, 'task', 'add', '--title', 'A new task', '--milestone', 'Phase 0', '--depends', 'B-690');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^B-691: new task/);
  const t = loadChart(dir).tasks.at(-1);
  assert.equal(t?.id, 'B-691');
  assert.deepEqual(t?.depends, ['B-690']);
  assert.match(read(dir, 'docs/record/BACKLOG.md'), /\| B-691 \| A new task \| B-690 \| Phase 0 \| open \|/);
  assert.equal(run(dir, 'render', '--check').code, 0);
});

test('task add refuses a dangling dependency and a report without its words', () => {
  const dir = scratch();
  assert.equal(run(dir, 'task', 'add', '--title', 'x', '--milestone', 'm', '--depends', 'B-9999').code, 1);
  assert.equal(run(dir, 'task', 'add', '--title', 'x', '--kind', 'bug').code, 1);
  const r = run(dir, 'task', 'add', '--title', 'Bug: x', '--kind', 'bug', '--words', 'it broke', '--source', 'chat');
  assert.equal(r.code, 0, r.out);
  const t = loadChart(dir).tasks.at(-1);
  assert.equal(t?.status, 'inbox');
  assert.equal(t?.reportedAt, NOW);
});

test('the claim is the lock: a second claim is refused, and set cannot skip it', () => {
  const dir = scratch();
  run(dir, 'task', 'add', '--title', 'Lock me', '--milestone', 'm');
  assert.equal(run(dir, 'task', 'claim', 'B-691').code, 1, 'needs --by');
  assert.equal(run(dir, 'task', 'claim', 'B-691', '--by', 'run-1').code, 0);
  const second = run(dir, 'task', 'claim', 'B-691', '--by', 'run-2');
  assert.equal(second.code, 1);
  assert.match(second.out, /already in progress \(held by run-1\)/);
  assert.equal(run(dir, 'task', 'set', 'B-691', '--status', 'in progress').code, 1);
  const t = loadChart(dir).tasks.at(-1);
  assert.equal(t?.claimedBy, 'run-1');
  assert.equal(run(dir, 'task', 'claim', 'B-690', '--by', 'run-3').code, 1, 'a done task is refused');
});

test('task set: done needs a commit, declined needs a reason, notes land', () => {
  const dir = scratch();
  run(dir, 'task', 'add', '--title', 'Finish me', '--milestone', 'm');
  assert.equal(run(dir, 'task', 'set', 'B-691', '--status', 'done').code, 1);
  assert.equal(run(dir, 'task', 'set', 'B-691', '--status', 'declined').code, 1);
  assert.equal(run(dir, 'task', 'set', 'B-691', '--status', 'bogus').code, 1);
  assert.equal(run(dir, 'task', 'set', 'B-691', '--status', 'done', '--commit', 'abcdef1234', '--notes', 'ok').code, 0);
  const t = loadChart(dir).tasks.at(-1);
  assert.equal(t?.commit, 'abcdef1');
  assert.equal(t?.notes, 'ok');
  assert.equal(lintChart(loadChart(dir)).filter(f => f.level === 'error').length, 0);
});

test('decision add takes the next D- id, newest first; supersedes marks the old one', () => {
  const dir = scratch();
  const r = run(dir, 'decision', 'add', '--title', 'New', '--why', 'Because', '--status', 'accepted', '--supersedes', 'D-425');
  assert.equal(r.code, 0, r.out);
  const rec = loadChart(dir);
  assert.equal(rec.decisions[0]?.id, 'D-426');
  assert.equal(rec.decisions[0]?.date, 'Nov 3');
  assert.equal(rec.decisions.find(d => d.id === 'D-425')?.status, 'superseded');
  assert.match(read(dir, 'docs/record/DECISIONS.md'), /\| D-426 \| Nov 3 \| New \| Because \| accepted \| supersedes D-425 \|/);
  assert.equal(run(dir, 'decision', 'add', '--title', 'x', '--amends', 'D-9999').code, 1);
  assert.equal(run(dir, 'decision', 'add', '--title', 'x', '--status', 'maybe').code, 1);
  assert.equal(run(dir, 'decision', 'set', 'D-426', '--why', 'Restated').code, 0);
  assert.equal(loadChart(dir).decisions[0]?.restated, 'Nov 3');
});

test('release add writes releases.json, never deploys.json; live needs Matt', () => {
  const dir = scratch();
  const deploys = read(dir, 'chart/deploys.json');
  const args = ['release', 'add', '--version', 'v5.0.0', '--commit', 'abcdef1', '--summary', 'First'];
  assert.equal(run(dir, ...args, '--target', 'live').code, 1);
  assert.equal(run(dir, ...args, '--target', 'staging').code, 0);
  assert.equal(run(dir, ...args, '--target', 'staging').code, 1, 'no duplicate');
  assert.equal(read(dir, 'chart/deploys.json'), deploys);
  assert.equal(loadChart(dir).releases[0]?.version, 'v5.0.0');
  assert.match(read(dir, 'docs/record/CHANGELOG.md'), /\| Nov 3 \| v5\.0\.0 staging at abcdef1 \(09:00 CT\): First\. \|/);
});

test('saveChart refuses any change to the frozen v4 deploys', () => {
  const dir = scratch();
  const rec = loadChart(dir);
  rec.deploys.push({ target: 'staging', commit: 'abcdef1', time: NOW });
  assert.throws(() => saveChart(dir, rec), /frozen v4 history/);
});

test('render --check exits 1 when a generated file differs', () => {
  const dir = scratch();
  assert.equal(run(dir, 'render', '--check').code, 0);
  fs.appendFileSync(path.join(dir, 'docs', 'record', 'BACKLOG.md'), 'x');
  const r = run(dir, 'render', '--check');
  assert.equal(r.code, 1);
  assert.match(r.out, /BACKLOG\.md: differs/);
});

test('lint reports dangling links in depends, supersedes, amends and rules', () => {
  const rec = loadChart(scratch());
  assert.equal(lintChart(rec).filter(f => f.level === 'error').length, 0, 'the carried record is clean');
  (rec.tasks[0] as { depends: string[] }).depends.push('B-9998');
  rec.decisions[0]?.supersedes.push('D-9997');
  rec.decisions[1]?.amends.push('D-9996');
  rec.rules.push({ id: 'R-99', rule: 'r', decision: 'D-9995', task: 'B-9994', command: 'c', check: 'f' });
  const got = lintChart(rec).map(f => `${f.check} ${f.detail}`);
  for (const id of ['B-9998', 'D-9997', 'D-9996', 'D-9995', 'B-9994'])
    assert.ok(got.some(g => g.includes(id)), `${id} reported`);
  assert.equal(main(['lint', '--root', ROOT], () => {}), 0);
});

test('no decision or task ids as reasons in code comments', () => {
  const offenders: string[] = [];
  for (const f of fs.readdirSync(HERE).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')))
    read(HERE, f)
      .split('\n')
      .forEach((l, i) => {
        const comment = l.match(/(?:^|\s)(?:\/\/|\/\*\*?|\*)\s(.*)$/);
        if (comment && /\b[BD]-\d{2,3}\b/.test(comment[1] as string)) offenders.push(`${f}:${i + 1}`);
      });
  assert.deepEqual(offenders, []);
});
