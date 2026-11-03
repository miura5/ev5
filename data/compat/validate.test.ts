import test from 'node:test';
import assert from 'node:assert/strict';
import { ev4WorkerProblem, goodNote, isDay, isIsoTime, schemaErrors, validateWrite } from './index.ts';
import { SAMPLES } from './samples/writes.ts';

for (const [collection, { valid, invalid }] of Object.entries(SAMPLES)) {
  for (const s of valid)
    test(`${collection}: accepts ${s.name}`, () => {
      assert.deepEqual(validateWrite(collection, s.doc, { id: s.id, prev: s.prev }), { ok: true });
    });
  for (const s of invalid)
    test(`${collection}: refuses ${s.name}`, () => {
      const r = validateWrite(collection, s.doc, { id: s.id, prev: s.prev });
      assert.equal(r.ok, false, `${s.name} was accepted`);
      const lines = r.ok ? [] : r.errors;
      assert.ok(s.why && lines.some(l => s.why!.test(l)), `no line matches ${s.why}: ${lines.join(' | ')}`);
    });
}

test('every collection v5 touches at cutover has valid and invalid samples', () => {
  for (const c of ['notes', 'dayedits', 'dates', 'weakspots', 'sets', 'answers']) {
    assert.ok(SAMPLES[c]?.valid.length, `${c} valid`);
    assert.ok((SAMPLES[c]?.invalid.length ?? 0) >= 2, `${c} invalid`);
  }
});

test('an unknown collection is refused, never passed', () => {
  for (const c of ['collections', 'memberships', 'drafts', 'Notes', 'notes/x', '__proto__', 'constructor'])
    assert.equal(validateWrite(c, goodNote()).ok, false, c);
});

test('legacy has no writer, so v5 never writes it', () => {
  const r = validateWrite('legacy', { migratedTo: 'x', writer: 'page', source: 'v5' });
  assert.ok(!r.ok && r.errors.some(e => /no one writes legacy/.test(e)));
});

test('a document with a shape of its own is checked as itself (talk/memory)', () => {
  assert.ok(schemaErrors('talk', { schema: 1, writer: 'page', at: '2026-11-02T15:00:00Z', source: 'v5' }, 'memory').length);
  assert.notDeepEqual(schemaErrors('talk', {}, 'memory'), schemaErrors('talk', {}, '2026-11-02'));
});

test("formats are ev4's: ISO UTC times with at most 3 decimals, and real calendar days", () => {
  for (const ok of ['2026-11-02T15:00:00Z', '2026-11-02T15:00:00.1Z', '2026-11-02T15:00:00.123Z', '2028-02-29T00:00:00Z'])
    assert.ok(isIsoTime(ok), ok);
  for (const bad of ['2026-11-02T15:00:00', '2026-11-02T15:00:00+00:00', '2026-11-02T15:00:00.1234Z', '2026-02-29T00:00:00Z', '2026-11-02 15:00:00Z', '2026-13-01T00:00:00Z'])
    assert.ok(!isIsoTime(bad), bad);
  assert.ok(isDay('2028-02-29'));
  for (const bad of ['2026-02-29', '2026-1-01', '2026-11-02T00:00:00Z']) assert.ok(!isDay(bad), bad);
});

test("the Worker's own check refuses a malformed, oversized or re-identified note, and passes other collections", () => {
  assert.equal(ev4WorkerProblem('notes', 'n-1', goodNote(), null), null);
  assert.match(ev4WorkerProblem('notes', 'n-1', { ...goodNote(), html: 'x' }, null) ?? '', /does not fit its shape/);
  const big = { ...goodNote(), blocks: Array.from({ length: 20 }, () => ({ type: 'p', runs: [{ text: 'x'.repeat(15000) }] })) };
  assert.match(ev4WorkerProblem('notes', 'n-1', big, null) ?? '', /bytes; a note holds at most 262144/);
  const moved = { ...goodNote(), createdAt: '2026-11-03T00:00:00Z' };
  assert.match(ev4WorkerProblem('notes', 'n-1', moved, goodNote()) ?? '', /createdAt is written once/);
  assert.equal(ev4WorkerProblem('scratch', 'x', { anything: true }, null), null);
});
