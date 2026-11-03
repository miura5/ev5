import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import app from './index.ts';

const doc = JSON.parse(readFileSync(join(import.meta.dirname, '../data/compat/routes.json'), 'utf8')) as {
  routes: { method: string; path: string }[];
};
const env = { DB: { prepare: () => ({ first: async () => null }) }, ASSETS: { fetch: async () => new Response('x') } };

for (const r of doc.routes) {
  test(`${r.method} ${r.path} is 410`, async () => {
    const res = await app.request(r.path.replace(/<[^>]+>/g, 'x'), { method: r.method }, env);
    assert.equal(res.status, 410);
  });
}

test('an unknown /api path stays 404 and health stays up', async () => {
  assert.equal((await app.request('/api/nope', {}, env)).status, 404);
  assert.equal((await app.request('/api/health', {}, env)).status, 200);
});
