import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMPAT_DIR,
  loadCollections,
  loadSchemas,
  readSource,
  schemaFiles,
  schemaWriters,
  sha256,
  unsupportedKeywords,
} from './index.ts';

const source = readSource();

test('SOURCE.md names the ev4 commit the copies were taken from', () => {
  assert.match(source.commit, /^[0-9a-f]{40}$/);
});

test('every frozen file still has the SHA-256 SOURCE.md records', () => {
  for (const [file, want] of Object.entries(source.hashes))
    assert.equal(sha256(readFileSync(join(COMPAT_DIR, file))), want, `${file} changed; the frozen copies never change`);
});

test('the frozen set is exactly the 36 schemas plus collections.json: nothing added, nothing missing', () => {
  const onDisk = [...readdirSync(join(COMPAT_DIR, 'schemas')).map(f => 'schemas/' + f), 'collections.json'].sort();
  assert.deepEqual(Object.keys(source.hashes).sort(), onDisk);
  assert.equal(schemaFiles().length, 36);
});

test("each schema's x-ev collection is its file name, and every schema uses only what ev4's validator enforces", () => {
  for (const [name, s] of Object.entries(loadSchemas())) {
    assert.equal(s['x-ev']?.collection, name);
    assert.deepEqual(unsupportedKeywords(s), [], name);
  }
});

test("collections.json and the schemas agree: the same 36 collections, classes and writer values", () => {
  const { collections } = loadCollections();
  const schemas = loadSchemas();
  assert.deepEqual(Object.keys(collections).sort(), Object.keys(schemas).sort());
  for (const [name, c] of Object.entries(collections)) {
    assert.equal(c.class, schemas[name]['x-ev']?.class, `${name} class`);
    assert.deepEqual([...schemaWriters(name)].sort(), [...c.writers].sort(), `${name} writer enum`);
    for (const [id, d] of Object.entries(c.documents ?? {}))
      assert.deepEqual(schemaWriters(name, id), d.writers, `${name}/${id} writer`);
  }
});
