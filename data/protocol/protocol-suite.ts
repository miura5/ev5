// The suite every ProtocolAdapter (the in-memory reference, and every future v5 repository over D1's `docs`) must
// pass. Runner-agnostic: each case is a plain async function using node:assert, registered by the caller's runner.
import assert from 'node:assert/strict';
import { canonicalText } from './canonical.ts';
import type { ProtocolAdapter } from './protocol.ts';

/** A server clock the suite moves by hand. */
export interface TestClock {
  now: number;
  read: () => number;
}
export const testClock = (start = 1_800_000_000_000): TestClock => {
  const c: TestClock = { now: start, read: () => c.now };
  return c;
};

/** Makes a fresh, empty adapter on the given clock, with the gate's write rules (the note case needs them). */
export type MakeAdapter = (clock: () => number) => ProtocolAdapter | Promise<ProtocolAdapter>;
export interface ProtocolCase {
  name: string;
  run: (a: ProtocolAdapter, clock: TestClock) => Promise<void>;
}

const C = 'scratch';
const set = (doc_id: string, data: unknown, if_version?: number | null, collection = C) => ({
  op: 'set', collection, doc_id, data, ...(if_version !== undefined ? { if_version } : {}),
});
const upd = (doc_id: string, data: unknown, if_version?: number | null) => ({ ...set(doc_id, data, if_version), op: 'update' });

/** A note the gate accepts (synthetic). */
export const goodNote = (title = 'Cardiac output') => ({
  schema: 1, writer: 'page', at: '2026-11-02T15:00:00Z', source: 'v5/test', createdAt: '2026-11-02T15:00:00Z',
  title, blocks: [{ type: 'p', runs: [{ text: 'Stroke volume times heart rate.' }] }],
});

async function versionOf(a: ProtocolAdapter, id: string, c = C) {
  return (await a.get(c, id))?.v ?? null;
}

export const PROTOCOL_CASES: ProtocolCase[] = [
  {
    name: 'a create is version 1, stamped with the server clock',
    async run(a, clock) {
      clock.now = 1_800_000_000_123;
      const r = await a.save(C, 'one', '{"a":1}', null);
      assert.deepEqual(r, { ok: true, at: clock.now, version: 1 });
      const b = await a.batch([set('two', { b: 2 })]);
      assert.ok(b.ok);
      const got = await a.get(C, 'two');
      assert.equal(got?.v, 1);
      assert.equal(got?.at, clock.now);
    },
  },
  {
    name: 'every write bumps v by exactly one and sets at from the server clock, on both write paths',
    async run(a, clock) {
      await a.save(C, 'd', '{"n":0}', null);
      for (let v = 1; v < 6; v++) {
        clock.now += 1000;
        const r = v % 2 ? await a.save(C, 'd', `{"n":${v}}`, v) : await a.batch([upd('d', { n: v }, v)]);
        assert.ok(r.ok, JSON.stringify(r));
        const got = await a.get(C, 'd');
        assert.equal(got?.v, v + 1);
        assert.equal(got?.at, clock.now, 'at is the server clock, not anything the body carries');
      }
    },
  },
  {
    name: 'a create carries no if_version; one that names a version for a missing document is 409',
    async run(a) {
      const r = await a.save(C, 'nope', '{}', 3);
      assert.equal(r.ok, false);
      assert.equal(!r.ok && r.status, 409);
      assert.equal(!r.ok && r.current_version, null);
      const b = await a.batch([set('nope', {}, 1)]);
      assert.equal(!b.ok && b.status, 409);
      assert.equal(await a.get(C, 'nope'), null, 'nothing was written');
    },
  },
  {
    name: 'a write to an existing document without if_version is 409 and writes nothing',
    async run(a) {
      await a.save(C, 'x', '{"keep":true}', null);
      const r = await a.save(C, 'x', '{"keep":false}', null);
      assert.equal(!r.ok && r.status, 409);
      assert.equal(!r.ok && r.current_version, 1);
      const b = await a.batch([set('x', { keep: false })]);
      assert.equal(!b.ok && b.status, 409);
      assert.deepEqual((await a.get(C, 'x'))?.data, { keep: true });
    },
  },
  {
    name: 'a version-pinned update that is stale is 409 with the current version, and writes nothing',
    async run(a) {
      await a.save(C, 'p', '{"n":1}', null);
      await a.save(C, 'p', '{"n":2}', 1);
      const r = await a.save(C, 'p', '{"n":99}', 1);
      assert.equal(!r.ok && r.status, 409);
      assert.equal(!r.ok && r.if_version, 1);
      assert.equal(!r.ok && r.current_version, 2);
      const b = await a.batch([upd('p', { n: 99 }, 1)]);
      assert.equal(!b.ok && b.status, 409);
      const got = await a.get(C, 'p');
      assert.equal(got?.v, 2);
      assert.deepEqual(got?.data, { n: 2 });
    },
  },
  {
    name: 'a batch is all or nothing: one stale entry, and no entry is written',
    async run(a, clock) {
      await a.batch([set('k1', { n: 1 }), set('k2', { n: 1 })]);
      await a.save(C, 'k2', '{"n":2}', 1);
      const before = clock.now;
      clock.now += 5000;
      const b = await a.batch([upd('k1', { n: 9 }, 1), set('k3', { n: 9 }), upd('k2', { n: 9 }, 1)]);
      assert.equal(!b.ok && b.status, 409);
      assert.equal(!b.ok && b.entry, 2);
      assert.deepEqual((await a.get(C, 'k1'))?.data, { n: 1 });
      assert.equal((await a.get(C, 'k1'))?.at, before);
      assert.equal(await a.get(C, 'k3'), null);
    },
  },
  {
    name: 'a batch with any malformed entry writes nothing',
    async run(a) {
      for (const bad of [
        { ...set('m2', {}), op: 'replace' },
        set('m2', [1, 2]),
        set('m2', { a: { __delete__: true } }),
        set('', {}),
        set('m2', {}, 0),
        set('m2', {}, null, 'a/b'),
      ]) {
        const b = await a.batch([set('m1', { n: 1 }), bad]);
        assert.equal(!b.ok && b.status, 400, JSON.stringify(bad));
      }
      assert.equal(!((await a.batch([set('m1', {}), set('m1', {})])) as { ok: boolean }).ok, true, 'same doc twice');
      assert.equal(((await a.batch([])) as { status?: number }).status, 400);
      const many = Array.from({ length: 51 }, (_, i) => set('n' + i, {}));
      assert.equal(((await a.batch(many)) as { status?: number }).status, 400);
      assert.deepEqual(await a.list(C), [], 'nothing was written');
      const fifty = await a.batch(many.slice(0, 50));
      assert.ok(fifty.ok, 'fifty writes is the most a batch holds');
    },
  },
  {
    name: 'a batch shares one at, and answers each version',
    async run(a, clock) {
      await a.save(C, 'b1', '{}', null);
      clock.now += 777;
      const b = await a.batch([upd('b1', { x: 1 }, 1), set('b2', { y: 2 })]);
      assert.ok(b.ok);
      assert.deepEqual(b.ok && b.results, [
        { collection: C, doc_id: 'b1', version: 2 },
        { collection: C, doc_id: 'b2', version: 1 },
      ]);
      assert.equal((await a.get(C, 'b1'))?.at, clock.now);
      assert.equal((await a.get(C, 'b2'))?.at, clock.now);
    },
  },
  {
    name: 'update merges objects deeply, replaces arrays, removes {"__delete__": true}; set replaces whole',
    async run(a) {
      await a.batch([set('u', { a: { b: 1, c: 2 }, list: [1, 2], gone: 1 })]);
      await a.batch([upd('u', { a: { c: 3 }, list: [9], gone: { __delete__: true } }, 1)]);
      assert.deepEqual((await a.get(C, 'u'))?.data, { a: { b: 1, c: 3 }, list: [9] });
      await a.batch([set('u', { only: true }, 2)]);
      assert.deepEqual((await a.get(C, 'u'))?.data, { only: true });
      await a.batch([upd('fresh', { made: 1 })]);
      assert.equal(await versionOf(a, 'fresh'), 1, 'an update creates a missing document at version 1');
    },
  },
  {
    name: 'there is no delete path: no delete method, and a delete op is 403 and writes nothing',
    async run(a) {
      for (const m of ['delete', 'remove', 'purge', 'drop', 'destroy', 'clear'])
        assert.equal((a as unknown as Record<string, unknown>)[m], undefined, `no ${m} method`);
      await a.save(C, 'stay', '{"n":1}', null);
      const b = await a.batch([set('other', {}), { op: 'delete', collection: C, doc_id: 'stay', data: {} }]);
      assert.equal(!b.ok && b.status, 403);
      assert.equal(await versionOf(a, 'stay'), 1);
      assert.equal(await a.get(C, 'other'), null);
    },
  },
  {
    name: 'an id is never recreated at a lower version',
    async run(a) {
      await a.save(C, 'r', '{"n":1}', null);
      await a.save(C, 'r', '{"n":2}', 1);
      await a.batch([upd('r', { n: 3 }, 2)]);
      for (const r of [
        await a.save(C, 'r', '{"n":0}', null),
        await a.batch([set('r', { n: 0 })]),
        await a.batch([upd('r', { n: 0 })]),
        await a.save(C, 'r', '{"n":0}', 1),
      ])
        assert.equal(!r.ok && r.status, 409);
      assert.equal(await versionOf(a, 'r'), 3);
      const next = await a.save(C, 'r', '{"n":4}', 3);
      assert.deepEqual(next.ok && next.version, 4);
    },
  },
  {
    name: 'documents are stored as canonical JSON on both write paths',
    async run(a) {
      await a.save(C, 'pretty', '{\n  "b" : 1.0,\n "a":"caf\\u00e9 \\/", "10":1, "2":2 }\n', null);
      assert.equal((await a.get(C, 'pretty'))?.text, '{"2":2,"10":1,"b":1,"a":"café /"}');
      await a.batch([set('run', { z: 1e2, a: [-0.5] })]);
      assert.equal((await a.get(C, 'run'))?.text, '{"z":100,"a":[-0.5]}');
      const got = await a.get(C, 'run');
      assert.equal(got?.text, canonicalText(got!.data));
    },
  },
  {
    name: 'a body that is not JSON, or holds a number JSON cannot, is 400 and writes nothing',
    async run(a) {
      assert.equal(((await a.save(C, 'j', '{"a":', null)) as { status?: number }).status, 400);
      assert.equal(((await a.save(C, 'j', '{"a":1e400}', null)) as { status?: number }).status, 400);
      assert.equal(((await a.save('a/b', 'j', '{}', null)) as { status?: number }).status, 400);
      assert.equal(((await a.save(C, '..', '{}', null)) as { status?: number }).status, 400);
      assert.equal(await a.get(C, 'j'), null);
    },
  },
  {
    name: 'changedSince reads every document written after since, and hands back a since a few seconds back',
    async run(a, clock) {
      await a.save(C, 'old', '{}', null);
      const t = clock.now;
      clock.now += 60_000;
      await a.save(C, 'new', '{}', null);
      const r = await a.changedSince(t);
      assert.deepEqual(r.docs.map(d => d.id), ['new']);
      assert.equal(r.now, clock.now - 5000);
      assert.equal((await a.changedSince(clock.now)).now, clock.now, 'never earlier than since');
      assert.deepEqual((await a.list(C)).map(d => d.id), ['new', 'old']);
    },
  },
  {
    name: 'a note the gate refuses is 400 on both paths, and its identity is write-once',
    async run(a) {
      const bad = { ...goodNote(), html: '<b>x</b>' };
      assert.equal(((await a.save('notes', 'n-a', JSON.stringify(bad), null)) as { status?: number }).status, 400);
      assert.equal(((await a.batch([set('n-a', bad, null, 'notes')])) as { status?: number }).status, 400);
      assert.equal(await a.get('notes', 'n-a'), null);
      assert.ok((await a.save('notes', 'n-a', JSON.stringify(goodNote()), null)).ok);
      const moved = { ...goodNote('Renamed'), createdAt: '2026-11-03T00:00:00Z' };
      assert.equal(((await a.save('notes', 'n-a', JSON.stringify(moved), 1)) as { status?: number }).status, 400);
      assert.ok((await a.save('notes', 'n-a', JSON.stringify(goodNote('Renamed')), 1)).ok, 'a title is a mark');
    },
  },
];

/** Registers every case with the caller's runner (node:test now, Vitest later). */
export function registerProtocolSuite(
  label: string,
  make: MakeAdapter,
  test: (name: string, fn: () => Promise<void>) => unknown
): void {
  for (const c of PROTOCOL_CASES)
    test(`${label}: ${c.name}`, async () => {
      const clock = testClock();
      await c.run(await make(clock.read), clock);
    });
}
