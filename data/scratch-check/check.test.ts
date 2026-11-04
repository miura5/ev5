import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkExport, errorTotal, exportProblem, render } from './check.ts';
import { PARSERS, pathProblem, run } from './cli.ts';

// Synthetic only: nothing here is, or looks like, Matt's data.
const exam = { schema: 2, writer: 'page', at: '2026-11-03T00:00:00Z', source: 'v5/test', title: 'Unit 3', kind: 'unit' };
const row = (c: string, id: string, data: unknown) => ({ c, id, data: JSON.stringify(data), at: 1, v: 1 });
const exp = (docs: unknown[]) => ({ kind: 'ev-d1-export', schema: 1, docs });

test('counts parsed, unchecked and failed documents per collection', () => {
  const r = checkExport(
    exp([row('exams', 'a', exam), row('exams', 'b', { ...exam, kind: 'nope' }), row('talk', 't', { x: 1 })]) as never,
    PARSERS,
  );
  assert.deepEqual(r.exams, { docs: 2, ok: 1, unchecked: 0, errors: { 'invalid value: kind': 1 } });
  assert.deepEqual(r.talk, { docs: 1, ok: 0, unchecked: 1, errors: {} });
  assert.equal(errorTotal(r), 1);
});

test('a document that is not JSON is a kind, and a clean export has zero errors', () => {
  const bad = checkExport({ docs: [{ c: 'exams', id: 'a', data: '{oops' }] }, PARSERS);
  assert.deepEqual(bad.exams?.errors, { 'not json': 1 });
  assert.equal(errorTotal(checkExport(exp([row('exams', 'a', exam)]) as never, PARSERS)), 0);
});

test('the report never carries document content', () => {
  const secret = 'ZEBRA-SECRET-4242';
  const docs = [
    row('exams', secret, { ...exam, [secret]: secret }),
    row('exams', 'x', { ...exam, title: 3 }),
    { c: secret, id: secret, data: secret },
  ];
  const text = render(checkExport({ docs }, PARSERS)).join('\n');
  assert.ok(!text.includes('ZEBRA') && !text.includes('4242'), text);
  assert.match(text, /exams: 3 docs|exams: 2 docs/);
});

test('exportProblem refuses what is not an export, with a fixed phrase', () => {
  assert.equal(exportProblem(exp([])), null);
  assert.match(exportProblem({ kind: 'other' }) ?? '', /not an ev-d1-export/);
  assert.match(exportProblem('x') ?? '', /not an export/);
});

test('the file must sit outside the repo and be owner-only; run prints counts and exits by errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scratch-check-'));
  const repo = join(dir, 'repo');
  mkdirSync(repo);
  const inside = join(repo, 'e.json');
  const outside = join(dir, 'e.json');
  for (const f of [inside, outside]) writeFileSync(f, JSON.stringify(exp([row('exams', 'a', exam)])));
  chmodSync(inside, 0o600);
  chmodSync(outside, 0o644);
  assert.match(pathProblem(inside, repo) ?? '', /inside this repository/);
  assert.match(pathProblem(outside, repo) ?? '', /readable by others/);
  assert.match(pathProblem(join(dir, 'missing.json'), repo) ?? '', /cannot be opened/);
  assert.equal(run(outside, repo).code, 2);
  chmodSync(outside, 0o600);
  assert.deepEqual(run(outside, repo), {
    lines: ['exams: 1 docs, 1 parsed, 0 unchecked, no errors', 'total: 1 docs in 1 collections, 0 errors'],
    code: 0,
  });
  writeFileSync(outside, JSON.stringify(exp([row('exams', 'a', { ...exam, schema: 9 })])));
  assert.equal(run(outside, repo).code, 1);
  assert.equal(run(undefined, repo).code, 2);
});
