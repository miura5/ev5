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
  const s: {
    online: boolean;
    status: number;
    docs: typeof docs;
    noteCalls: Record<string, unknown>[];
    transport: Transport;
  } = {
    online: true,
    noteCalls: [],
    status: 0, // forces this answer to the next put when set
    docs,
    transport: {
      async put(c, id, body, ifVersion) {
        if (c === 'notes') throw new Error('a note is saved by note.save, not PUT /docs');
        if (!s.online) throw new Error('offline');
        if (s.status) return { status: s.status, text: 'no' };
        const cur = docs.get(`${c}/${id}`);
        if ((cur?.v ?? null) !== ifVersion) return { status: 409 };
        const v = (cur?.v ?? 0) + 1;
        docs.set(`${c}/${id}`, { v, data: JSON.parse(body) });
        return { status: 200, version: v };
      },
      async command(name, input) {
        if (!s.online) throw new Error('offline');
        if (name === 'note.save') {
          // as the command does: pinned to if_version (0: new), 409 when stale
          s.noteCalls.push(input as Record<string, unknown>);
          const i = input as { id: string; body: string; if_version: number; title: string; earlier_of?: string };
          if (s.status) return { status: s.status, text: 'no' };
          const cur = docs.get(`notes/${i.id}`);
          if ((cur?.v ?? 0) !== i.if_version) return { status: 409 };
          const v = (cur?.v ?? 0) + 1;
          const data = { title: i.title, blocks: JSON.parse(i.body), ...(i.earlier_of ? { earlierOf: i.earlier_of } : {}) };
          docs.set(`notes/${i.id}`, { v, data });
          return { status: 200, version: v };
        }
        const id = (input as { attempt: string }).attempt;
        if (s.status) return { status: s.status, text: 'no' };
        if (docs.has(`${name}/${id}`)) return { status: 409 };
        docs.set(`${name}/${id}`, { v: 1, data: input });
        return { status: 200 };
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

  test('an edit made offline survives a reload that is still offline, then saves (§data.offline)', async () => {
    const { server, store, box } = make();
    server.docs.set(`notes/${ID}`, { v: 2, data: note('Fluids', 'old') });
    server.online = false;
    await box.queueNote(ID, note('Fluids', 'edited offline'), 2);
    // The page reloads: a new outbox over the same store, still offline.
    const reloaded = createOutbox({ store, transport: server.transport, now: () => 1_790_000_100_000, random: () => 'x' });
    expect(await reloaded.count()).toBe(1);
    expect((await reloaded.replay()).stopped).toBe('offline');
    expect(store.size()).toBe(1);
    server.online = true;
    expect(await reloaded.replay()).toMatchObject({ sent: 1, kept: [] });
    expect(server.docs.get(`notes/${ID}`)).toMatchObject({ v: 3 });
    expect(JSON.stringify(server.docs.get(`notes/${ID}`)?.data)).toContain('edited offline');
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
    expect(earlier.blocks).toEqual(note('Fluids', 'edited on the phone').blocks);
  });

  test('a note goes by note.save, pinned to the version read (0 for a new note)', async () => {
    const { server, box } = make();
    await box.queueNote(ID, note('Fluids', 'one'), null);
    await box.replay();
    await box.queueNote(ID, note('Fluids', 'two'), 1);
    await box.replay();
    expect(server.noteCalls.map((c) => c.if_version)).toEqual([0, 1]);
    expect(server.noteCalls[1]).toMatchObject({ id: ID, title: 'Fluids' });
    expect(JSON.parse(server.noteCalls[1]!.body as string)).toEqual(note('Fluids', 'two').blocks);
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

  const told = (setId: string, item: string) => ({
    schema: 2,
    setId,
    answers: { [item]: { k: { outcome: 'told', at: 'x' } } },
  });
  const rated = (setId: string, item: string, text: string) => ({
    schema: 2,
    setId,
    answers: { [item]: { k: { rating: 'good', at: 'x', text } } },
  });

  test('an answer queued as an answers document posts as a command under an att_ id, never PUT /docs', async () => {
    const { server, box } = make();
    await box.queueAnswer('answers', 'set_1-page-1', rated('set_1', 'item_1', 'my try'));
    await box.queueAnswer('answers', 'set_1-page-2', told('set_1', 'item_2'));
    const r = await box.replay();
    expect(r.sent).toBe(2);
    const a = server.docs.get('study.attempt/att_set1page1')?.data;
    expect(a).toEqual({ id: 'set_1/item_1', answer: 'my try', rating: 'good', attempt: 'att_set1page1' });
    expect(server.docs.get('study.just_tell_me/att_set1page2')?.data).toEqual({
      id: 'set_1/item_2',
      attempt: 'att_set1page2',
    });
    expect([...server.docs.keys()].some((k) => k.startsWith('answers/'))).toBe(false);
    expect(await box.waiting()).toEqual([]);
  });

  test('an answer already recorded (409) drops out; a replay after a lost reply posts the same att_ id', async () => {
    const { server, box } = make();
    server.docs.set('study.attempt/att_s1p', { v: 1, data: {} });
    await box.queueAnswer('answers', 's-1-p', rated('s', '1', 'x'));
    expect((await box.replay()).sent).toBe(1);
    expect(await box.count()).toBe(0);
  });

  test('check.answer and ask.just_tell_me post under their att_ ids; a repeat is already recorded', async () => {
    const { server, box } = make();
    await box.queueCommand('check.answer', 'att_c1', { id: 'q1', answer: 'x', attempt: 'att_c1' });
    await box.queueCommand('ask.just_tell_me', 'att_a1', { id: 'turn1', attempt: 'att_a1' });
    server.docs.set('ask.just_tell_me/att_a1', { v: 1, data: {} });
    expect((await box.replay()).sent).toBe(2);
    expect(server.docs.has('check.answer/att_c1')).toBe(true);
    expect(await box.waiting()).toEqual([]);
  });

  test('a refused answer is kept, named to the listener with its reason, and not sent again', async () => {
    const { server, box } = make();
    const seen: { key: string; id: string; reason: string }[][] = [];
    const stop = box.onRefused((r) => void seen.push(r));
    await box.queueAnswer('answers', 'set_1-page-1', told('set_1', 'item_1'));
    server.status = 400;
    expect((await box.replay()).refused).toHaveLength(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.[0]?.reason).toContain('400');
    expect(await box.count()).toBe(0);
    expect(await box.waiting()).toHaveLength(1);
    stop();
    await box.queueCommand('study.attempt', 'att_x', { id: 'a/b', attempt: 'att_x' });
    await box.replay();
    expect(seen).toHaveLength(1);
  });

  test('a command answer is posted under its att_ id; a repeat (409) is already recorded and drops out', async () => {
    const { server, box } = make();
    await box.queueCommand('study.just_tell_me', 'att_1', { id: 's/q', attempt: 'att_1' });
    await box.queueCommand('study.just_tell_me', 'att_2', { id: 's/q', attempt: 'att_2' });
    server.docs.set('study.just_tell_me/att_2', { v: 1, data: {} });
    const r = await box.replay();
    expect(r.sent).toBe(2);
    expect(server.docs.has('study.just_tell_me/att_1')).toBe(true);
    expect(await box.waiting()).toEqual([]);
  });

  test('a command refused for good is kept and shown with its reason, not dropped', async () => {
    const { server, box } = make();
    await box.queueCommand('study.just_tell_me', 'att_1', { id: 's/q', attempt: 'att_1' });
    server.status = 400;
    expect((await box.replay()).refused).toHaveLength(1);
    expect((await box.waiting())[0]?.refused).toContain('400');
  });
});
