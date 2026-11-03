import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSource } from './index.ts';

interface Route {
  method: string;
  path: string;
  query: string;
  file: string;
  purpose: string;
}
const doc = JSON.parse(readFileSync(join(import.meta.dirname, 'routes.json'), 'utf8')) as {
  ev4Commit: string;
  routes: Route[];
};

test('routes.json is read from the same ev4 commit as the frozen schemas', () => {
  assert.equal(doc.ev4Commit, readSource().commit);
});

test('each ev4 route is listed once, under /api/, with a method, its file and a purpose', () => {
  const seen = new Set<string>();
  for (const r of doc.routes) {
    const key = `${r.method} ${r.path}`;
    assert.ok(['GET', 'PUT', 'POST', 'DELETE'].includes(r.method), key);
    assert.match(r.path, /^\/api\//, key);
    assert.match(r.file, /^pwa\/[a-z]+\.js$/, key);
    assert.ok(r.purpose.length > 10, key);
    assert.equal(typeof r.query, 'string', key);
    assert.ok(!seen.has(key), `${key} twice`);
    seen.add(key);
  }
  assert.equal(doc.routes.length, 19);
});

test('the protocol routes v5 keeps the semantics of are all present', () => {
  const keys = new Set(doc.routes.map(r => `${r.method} ${r.path}`));
  for (const k of ['GET /api/db', 'PUT /api/db/<collection>/<id>', 'GET /api/run/get', 'POST /api/run/batch'])
    assert.ok(keys.has(k), k);
});
