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

test('ev4 page files answer a plain "E.V. has moved, reload" and are never cached', async () => {
  for (const p of ['/bridge.js', '/app.js', '/core.js', '/spec.json', '/styles.css']) {
    const res = await app.request(p, {}, env);
    assert.equal(res.status, 410, p);
    assert.equal(await res.text(), 'E.V. has moved, reload');
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
});

test('ev4 api answers carry the reload text; v5 files still reach the assets', async () => {
  const res = await app.request('/api/db', {}, env);
  assert.deepEqual(await res.json(), { error: 'gone', message: 'E.V. has moved, reload' });
  for (const p of ['/', '/sw.js', '/manifest.webmanifest', '/assets/x.js']) {
    assert.equal(await (await app.request(p, {}, env)).text(), 'x', p);
  }
});

test("retire-ev4.js clears ev4's caches and reloads clients only when they exist", async () => {
  const src = readFileSync(join(import.meta.dirname, '../public/retire-ev4.js'), 'utf8');
  const run = async (names: string[]) => {
    const deleted: string[] = [];
    const navigated: string[] = [];
    let handler: (e: { waitUntil(p: Promise<unknown>): void }) => void = () => {};
    const self = {
      addEventListener: (_: string, f: typeof handler) => (handler = f),
      clients: { matchAll: async () => [{ url: '/a', navigate: async (u: string) => navigated.push(u) }] },
    };
    new Function('self', 'caches', src)(self, {
      keys: async () => names,
      delete: async (n: string) => deleted.push(n),
    });
    let p: Promise<unknown> = Promise.resolve();
    handler({ waitUntil: (x) => (p = x) });
    await p;
    return { deleted, navigated };
  };
  assert.deepEqual(await run(['ev-page', 'ev-shell-1', 'ev-shell-meta', 'workbox-precache-v2']), {
    deleted: ['ev-page', 'ev-shell-1', 'ev-shell-meta'],
    navigated: ['/a'],
  });
  assert.deepEqual(await run(['workbox-precache-v2']), { deleted: [], navigated: [] });
});
