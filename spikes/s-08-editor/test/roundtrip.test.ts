// S-08 spike: the round trip held to its bar. `node --test test/` from spikes/s-08-editor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAll } from '../src/run.ts';
import { runEdits } from '../src/edits.ts';

const { results, precheck, docResults } = runAll();

test('the corpus is valid ev4 data and normal cases are in ev4 normal form', () => {
  assert.deepEqual(precheck, []);
});

for (const p of ['direct', 'json+state', 'tiptap'] as const) {
  test(`${p}: every case comes back deep-equal and byte-equal`, () => {
    const bad = results.filter(r => r.path === p && !r.bytes).map(r => `${r.name}: ${r.error || r.diff}`);
    assert.deepEqual(bad, []);
  });
}

test('direct-raw (no translated export rules) loses exactly the two known cases', () => {
  const bad = results.filter(r => r.path === 'direct-raw' && !r.bytes).map(r => r.name).sort();
  assert.deepEqual(bad, ['a 45,000-character run, stored as 3 runs at the cap', 'all 32 combinations of b, i, u, s, href']);
});

test('stock Tiptap nested lists lose the indent jumps', () => {
  const bad = results.filter(r => r.path === 'stock-tiptap' && !r.deep).map(r => r.name).sort();
  assert.deepEqual(bad, [
    '4,000 lines, every type in turn',
    'first line of the note indented',
    'indented item right after a paragraph',
    'jump from 0 to 3',
    'row first and last in the note, two rows touching',
  ]);
});

test('whole notes: envelope outside the editor, saved through ev4 noteDoc, byte-equal and schema-valid', () => {
  assert.deepEqual(docResults.filter(d => !d.ok), []);
});

test('edit sample: all but the one-column row land on the blocks ev4 expects', () => {
  const bad = runEdits().filter(e => !e.ok).map(e => e.name);
  assert.deepEqual(bad, ['picture deleted out of its row: the text goes full width']);
});
