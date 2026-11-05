import { describe, expect, test } from 'vitest';
import type { Note } from '../../domain/index.ts';
import { createOutbox, memoryStore, type Transport } from './index.ts';

const note = (title: string, text: string): Note => ({
  schema: 1,
  writer: 'page',
  at: '2026-11-03T15:00:00.000Z',
  source: 'app',
  createdAt: '2026-11-03T15:00:00.000Z',
  title,
  blocks: [{ type: 'p', runs: [{ text }] }],
});

/** A record that pins writes to a version, as the Worker does (409 when stale), and can be switched offline. */
function fakeServer() {
  const docs = new Map<string, { v: number; data: unknown }>();
  const s: { online: boolean; status: number; docs: typeof docs; transport: Transport } = {
    online: true,
    status: 0, // forces this answer to the next put when set
    docs,
    transport: {
      async put(c, id, body, ifVersion) {
        if (!s.online) throw new Error('offline');
        if (s.status) return { status: s.status, text: 'no' };
        const cur = docs.get(`${c}/${id}`);
        if ((cur?.v ?? null) !== ifVersion) return { status: 409 };
        const v = (cur?.v ?? 0) + 1;
        docs.set(`${c}/${id}`, { v, data: JSON.parse(body) });
        return { status: 200, version: v };
      },
      async get(c, id) {
        if (!s.online) throw new Error('offline');
        const cur = docs.get(`${c}/${id}`);
        return cur ? { status: 200, version: cur.v, data: cur.data } : { status: 404 };
      },
    },
  };
  return s;
}

let n = 0;
const make = () => {
  const server = fakeServer();
  const store = memoryStore();
  const box = createOutbox({
    store,
    transport: server.transport,
    now: () => 1_790_000_000_000 + n++,
    random: (len) => 'abcdefghijklmnopqrstuvwxyz'.repeat(2).slice(0, len),
  });
  return { server, store, box };
};
const ID = 'n-20261103-150000-aaaaaaaaaaaa';

describe('the offline note journey', () => {
  test('write a note offline, then sync', async () => {
    const { server, store, box } = make();
    server.online = false;
    await box.queueNote(ID, note('Fluids', 'first'), null);
    await box.queueNote(ID, note('Fluids', 'first and more'), null);
    expect(await box.count()).toBe(1); // one entry per note: the latest words
    expect((await box.replay()).stopped).toBe('offline');
    expect(store.size()).toBe(1);

    server.online = true;
    const r = await box.replay();
    expect(r).toMatchObject({ sent: 1, kept: [] });
    expect(store.size()).toBe(0);
    expect(server.docs.get(`notes/${ID}`)).toMatchObject({ v: 1 });
    expect(JSON.stringify(server.docs.get(`notes/${ID}`)?.data)).toContain('first and more');
  });

  test('a stale save keeps both: the record stays the note, his words become "(earlier)"', async () => {
    const { server, box } = make();
    server.docs.set(`notes/${ID}`, { v: 3, data: note('Fluids', 'edited on the laptop') });
    await box.queueNote(ID, note('Fluids', 'edited on the phone'), 2);
    const r = await box.replay();
    expect(r.kept).toHaveLength(1);
    const [, earlierId] = r.kept[0]!;
    expect(server.docs.get(`notes/${ID}`)?.v).toBe(3); // untouched
    const earlier = server.docs.get(`notes/${earlierId}`)?.data as Note;
    expect(earlier.title).toBe('Fluids (earlier)');
    expect(earlier.earlierOf).toBe(ID);
    expect(await box.count()).toBe(0);
  });

  test('a stale save of the same words writes nothing twice', async () => {
    const { server, box } = make();
    server.docs.set(`notes/${ID}`, { v: 2, data: note('Fluids', 'same') });
    await box.queueNote(ID, note('Fluids', 'same'), 1);
    expect((await box.replay()).kept).toEqual([]);
    expect(server.docs.size).toBe(1);
    expect(await box.count()).toBe(0);
  });

  test('a save made while one is out goes next, pinned to the version just written', async () => {
    const { server, box } = make();
    await box.queueNote(ID, note('A', 'one'), null);
    await box.replay();
    await box.queueNote(ID, note('A', 'two'), 1);
    await box.replay();
    expect(server.docs.get(`notes/${ID}`)?.v).toBe(2);
  });
});

describe('what stays and what is refused', () => {
  test('a busy Worker stops the replay and keeps the entry', async () => {
    const { server, box } = make();
    await box.queueNote(ID, note('A', 'one'), null);
    server.status = 503;
    expect((await box.replay()).stopped).toBe('busy');
    expect(await box.count()).toBe(1);
  });

  test('a note refused for good is kept, unsent, until a new save replaces it', async () => {
    const { server, box } = make();
    await box.queueNote(ID, note('A', 'one'), null);
    server.status = 400;
    expect((await box.replay()).refused).toHaveLength(1);
    expect(await box.count()).toBe(0);
    expect(await box.waiting()).toHaveLength(1);
    server.status = 0;
    await box.queueNote(ID, note('A', 'cut down'), null);
    expect((await box.replay()).sent).toBe(1);
  });

  test('an answer is a create, and an answer already recorded drops out', async () => {
    const { server, box } = make();
    await box.queueAnswer('answers', 'a-1', { picked: 2 });
    await box.queueAnswer('answers', 'a-2', { picked: 1 });
    server.docs.set('answers/a-2', { v: 1, data: {} });
    const r = await box.replay();
    expect(r.sent).toBe(2);
    expect(server.docs.get('answers/a-1')?.v).toBe(1);
    expect(await box.waiting()).toEqual([]);
  });
});
