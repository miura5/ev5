// The offline outbox: note saves and practice answers wait here until a replay sends them (PLAN §5.9).
// A note goes pinned to the version it was read at. A stale one (409) is never merged: the record's version stays the
// note and the saved words become a second note, "<title> (earlier)" (domain/note resolveStale). Nothing is lost.
import { resolveStale, type Note } from '../../domain/index.ts';
import type { OutboxEntry, OutboxKind, OutboxStore, ReplayResult, Transport } from './types.ts';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export interface OutboxOptions {
  store: OutboxStore;
  transport: Transport;
  /** ms since the epoch */
  now?: () => number;
  /** n random letters and digits */
  random?: (n: number) => string;
}

const defaultRandom = (n: number): string =>
  Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => ALPHABET[x % ALPHABET.length]).join('');

export const entryKey = (c: string, id: string): string => `${c}\n${id}`;

export function createOutbox(opts: OutboxOptions) {
  const { store, transport } = opts;
  const now = opts.now ?? Date.now;
  const random = opts.random ?? defaultRandom;
  let replaying: Promise<ReplayResult> | null = null;

  async function enqueue(kind: OutboxKind, c: string, id: string, doc: OutboxEntry['doc'], base: number | null) {
    const key = entryKey(c, id);
    const was = (await store.all()).find((e) => e.key === key);
    // A save built on an entry that is still waiting keeps that entry's base: if the record moved on, the send is stale.
    const entry: OutboxEntry = { key, kind, c, id, doc, base: was ? was.base : base, tag: random(12), at: now() };
    await store.put(entry);
    return entry;
  }

  /** A note saved with no connection (or while an earlier save of it waits). */
  const queueNote = (id: string, doc: Note, base: number | null) => enqueue('note', 'notes', id, doc, base);
  /** A practice answer: append-only, so always a create. `c` is the collection the answer is written to. */
  const queueAnswer = (c: string, id: string, doc: Record<string, unknown>) => enqueue('answer', c, id, doc, null);

  const waiting = async () => (await store.all()).sort((a, b) => a.at - b.at);
  const sendable = async () => (await waiting()).filter((e) => !e.refused);

  async function sendOne(o: OutboxEntry, out: ReplayResult): Promise<'go' | 'stop'> {
    const r = await transport.put(o.c, o.id, JSON.stringify(o.doc), o.base);
    if (r.status >= 200 && r.status < 300) {
      out.sent++;
      await store.remove(o.key, o.tag);
      // a save made while this one was out was built on these words: it goes next, pinned to what was just written
      const next = (await store.all()).find((e) => e.key === o.key);
      if (next && r.version !== undefined) await store.put({ ...next, base: r.version });
      return 'go';
    }
    if (r.status === 409) {
      if (o.kind === 'answer') return (await store.remove(o.key, o.tag), out.sent++, 'go'); // already recorded
      await keepBoth(o, out);
      return 'go';
    }
    if (r.status === 401) return ((out.stopped = 'auth'), 'stop');
    if (r.status === 429 || r.status >= 500) return ((out.stopped = 'busy'), 'stop');
    // refused for good (its shape or size): kept on this device, unsent, until a new save replaces it
    const why = `${r.status} ${(r.text ?? '').slice(0, 200)}`.trim();
    await store.put({ ...o, refused: why });
    out.refused.push(o.key);
    return 'go';
  }

  async function keepBoth(o: OutboxEntry, out: ReplayResult) {
    const got = await transport.get(o.c, o.id);
    if (got.status === 404) return void (await store.put({ ...o, base: null })); // never written: send as a create
    if (got.status !== 200) throw new Error(`get answered ${got.status}`);
    const at = new Date(now()).toISOString();
    const res = resolveStale({ id: o.id, his: o.doc as Note, current: got.data as Note, at, random: random(16) });
    if (res.kind === 'both') {
      await store.put({
        key: entryKey(o.c, res.earlierId),
        kind: 'note',
        c: o.c,
        id: res.earlierId,
        doc: res.earlier,
        base: null,
        tag: random(12),
        at: now(),
      });
      out.kept.push([o.id, res.earlierId]);
    }
    await store.remove(o.key, o.tag);
    out.sent++;
  }

  async function run(): Promise<ReplayResult> {
    const out: ReplayResult = { sent: 0, kept: [], refused: [] };
    try {
      // a stale save adds its earlier copy to the queue, so go round again until a round sends nothing
      for (let round = 0; round < 20; round++) {
        const before = out.sent;
        for (const o of await sendable()) if ((await sendOne(o, out)) === 'stop') return out;
        if (out.sent === before) break;
      }
    } catch {
      out.stopped = 'offline'; // a rejected call: the outbox waits
    }
    return out;
  }

  /** Send everything that waits. One replay runs at a time; a second call joins it. */
  const replay = (): Promise<ReplayResult> => (replaying ??= run().finally(() => (replaying = null)));

  return { queueNote, queueAnswer, replay, waiting, count: async () => (await sendable()).length };
}

export type Outbox = ReturnType<typeof createOutbox>;
