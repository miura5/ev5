import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { pathProblem, render, roundTripNotes, run } from './roundTrip.script.ts';

// Synthetic notes only: nothing here is, or looks like, Matt's data.
const note = (blocks: unknown) => ({
  schema: 1,
  writer: 'page',
  at: '2026-11-03T00:00:00Z',
  source: 'v5/test',
  createdAt: '2026-11-03T00:00:00Z',
  title: 'Synthetic',
  course: null,
  blocks,
  editedAt: '2026-11-03T00:00:00Z',
});
const row = (data: unknown, c = 'notes') => ({
  c,
  id: 'x',
  data: JSON.stringify(data),
  at: 1,
  v: 1,
});
const rich = [
  { type: 'h1', runs: [{ text: 'Heading' }] },
  {
    type: 'p',
    runs: [{ text: 'plain ' }, { text: 'bold', b: true }, { text: ' link', href: 'https://example.com' }],
  },
  { type: 'ul', indent: 1, runs: [{ text: 'item' }] },
  { type: 'todo', checked: true, runs: [{ text: 'done' }] },
  {
    type: 'img',
    runs: [],
    key: 'note-images/abcdEFGH12345678.png',
    width: 200,
  },
];

test('counts stable, failed and ignores other collections', () => {
  const r = roundTripNotes([row(note(rich)), row(note([])), row({ nope: 1 }), row(note(rich), 'exams'), 'junk']);
  expect(r).toEqual({ notes: 3, stable: 1, changed: 1, failed: { ZodError: 1 } });
});

test('a note stored short of the normal form (no block at all) comes back changed', () => {
  expect(roundTripNotes([row(note([]))])).toEqual({ notes: 1, stable: 0, changed: 1, failed: {} });
});

test('the report never carries note text', () => {
  const secret = 'ZEBRA-SECRET-4242';
  const text = render(
    roundTripNotes([row(note([{ type: 'p', runs: [{ text: secret }] }])), row({ title: secret })]),
  ).join('\n');
  expect(text).not.toMatch(/ZEBRA|4242/);
  expect(text).toMatch(/^notes: 2, stable: 1, changed: 0, failed: 1/);
});

test('the file must sit outside the repo and be owner-only; run exits by problems', () => {
  const dir = mkdtempSync(join(tmpdir(), 'round-trip-'));
  const repo = join(dir, 'repo');
  mkdirSync(repo);
  const exp = JSON.stringify({
    kind: 'ev-d1-export',
    schema: 1,
    docs: [row(note(rich))],
  });
  const inside = join(repo, 'e.json');
  const open = join(dir, 'open.json');
  const ok = join(dir, 'ok.json');
  for (const f of [inside, open, ok]) writeFileSync(f, exp);
  chmodSync(inside, 0o600);
  chmodSync(open, 0o644);
  chmodSync(ok, 0o600);
  expect(pathProblem(inside, repo)).toMatch(/inside this repository/);
  expect(pathProblem(open, repo)).toMatch(/readable by others/);
  expect(pathProblem(join(dir, 'missing.json'), repo)).toMatch(/cannot be opened/);
  expect(run(open, repo).code).toBe(2);
  expect(run(undefined, repo).code).toBe(2);
  expect(run(ok, repo)).toEqual({
    lines: ['notes: 1, stable: 1, changed: 0, failed: 0'],
    code: 0,
  });
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{"kind":"other"}');
  chmodSync(bad, 0o600);
  expect(run(bad, repo).code).toBe(2);
});
