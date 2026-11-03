import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson, canonicalText, finiteJson } from './index.ts';

const samples = JSON.parse(readFileSync(join(import.meta.dirname, 'samples/canonical.json'), 'utf8')) as {
  canonical: { in: string; out: string }[];
  refused: { in: string; error: string }[];
};

test('canonicalJson gives the exact text ev4 stores for each sample body', () => {
  for (const s of samples.canonical) assert.equal(canonicalJson(s.in).text, s.out, JSON.stringify(s.in));
});

test('canonical text keeps the data, is a fixpoint, and is what a read re-serialises to', () => {
  for (const s of samples.canonical) {
    const { text } = canonicalJson(s.in);
    assert.ok(text !== undefined);
    // The one change to the data is the sign of a zero: -0 is stored as 0, as in ev4.
    const unsigned = (t: string) => JSON.parse(t, (_k, v) => (Object.is(v, -0) ? 0 : v));
    assert.deepEqual(JSON.parse(text), unsigned(s.in), 'the same data');
    assert.equal(canonicalJson(text).text, text, 'canonicalising twice changes nothing');
    assert.equal(canonicalText(JSON.parse(text)), text, 'a read and re-serialise gives it back');
  }
});

test('a body that is not JSON, or holds a number JSON cannot, is refused with ev4 wording', () => {
  for (const s of samples.refused) assert.deepEqual(canonicalJson(s.in), { error: s.error }, s.in);
});

test('finiteJson finds a non-finite number at any depth', () => {
  assert.equal(finiteJson({ a: [1, { b: 2.5 }], c: 'Infinity' }), true);
  assert.equal(finiteJson({ a: [1, { b: Infinity }] }), false);
  assert.equal(finiteJson([NaN]), false);
});
