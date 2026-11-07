// The offline outbox: note saves and practice answers wait here until a replay sends them (PLAN §5.9).
// Every entry is sent as a command, never PUT /docs (§data.gate: one gate; §data.protocol: pinned to `if_version`).
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

/** Names the refused entries a replay found; the shell shows them (never kept silently). */
export type RefusedListener = (refused: { key: string; id: string; reason: string }[]) => void;

/** A device that queued an answer before commands existed holds an `answers` document (setId, item, attempt key).
 * It is posted as the command that now writes that row (§data.gate, §data.append-only: one attempts row, no delete),
 * under an att_ id made from the entry's own id, so a replay after a lost reply is a 409 and never a second row. */
export function answerCommand(o: Pick<OutboxEntry, 'id' | 'doc'>): { name: string; input: Record<string, unknown> } | null {
  const d = o.doc as { setId?: unknown; answers?: Record<string, Record<string, Record<string, unknown>>> };
  if (typeof d.setId !== 'string' || !d.answers) return null;
  const [itemId, tries] = Object.entries(d.answers)[0] ?? [];
  const t = Object.values(tries ?? {})[0];
  if (!itemId || !t) return null;
  const attempt = `att_${o.id.replace(/[^A-Za-z0-9]/g, '')}`;
  const id = `${d.setId}/${itemId}`;
  if (t.outcome === 'told') return { name: 'study.just_tell_me', input: { id, attempt } };
  const rating = t.rating === 'again' || t.rating === 'good' ? t.rating : undefined;
  return {
    name: 'study.attempt',
    input: { id, answer: typeof t.text === 'string' ? t.text : '', ...(rating ? { rating } : {}), attempt },
  };
}

/** A note entry as the note.save command takes it, pinned to the version it was read at (0: a new note). */
export function noteSaveInput(o: OutboxEntry): Record<string, unknown> {
  const n = o.doc as Note;
  return {
    id: o.id,
    body: JSON.stringify(n.blocks),
    if_version: o.base ?? 0,
    title: n.title,
    ...(n.earlierOf ? { earlier_of: n.earlierOf } : {}),
  };
}

export const entryKey = (c: string, id: string): string => `${c}\n${id}`;

export function createOutbox(opts: OutboxOptions) {
  const { store, transport } = opts;
  const now = opts.now ?? Date.now;
  const random = opts.random ?? defaultRandom;
  let replaying: Promise<ReplayResult> | null = null;
  const listeners = new Set<RefusedListener>();

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

  /** A practice answer posted as a command (study.attempt, study.just_tell_me), the only way an answer queues now under a client-made att_ id: a replay
   * that names the same id is a 409, which means it is already recorded. */
  const queueCommand = (name: string, id: string, input: Record<string, unknown>) =>
    enqueue('command', name, id, input, null);

  const waiting = async () => (await store.all()).sort((a, b) => a.at - b.at);
  const sendable = async () => (await waiting()).filter((e) => !e.refused);

  async function sendOne(o: OutboxEntry, out: ReplayResult): Promise<'go' | 'stop'> {
    const legacy = o.kind === 'answer' ? answerCommand(o) : null;
    const r =
      o.kind === 'command'
        ? await transport.command(o.c, o.doc)
        : legacy
          ? await transport.command(legacy.name, legacy.input)
          : o.kind === 'note'
            ? await transport.command('note.save', noteSaveInput(o))
            : { status: 400, text: 'an old answer entry with no item to post to' }; // kept, shown, never sent
    if (r.status >= 200 && r.status < 300) {
      out.sent++;
      await store.remove(o.key, o.tag);
      // a save made while this one was out was built on these words: it goes next, pinned to what was just written
      const next = (await store.all()).find((e) => e.key === o.key);
      if (next && r.version !== undefined) await store.put({ ...next, base: r.version });
      return 'go';
    }
    if (r.status === 409) {
      if (o.kind !== 'note') return (await store.remove(o.key, o.tag), out.sent++, 'go'); // already recorded
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
    const got = await transport.get(o.id);
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
    if (out.refused.length) {
      const all = await store.all();
      const shown = out.refused.flatMap((k) => {
        const e = all.find((x) => x.key === k);
        return e ? [{ key: k, id: e.id, reason: e.refused ?? '' }] : [];
      });
      for (const l of listeners) l(shown);
    }
    return out;
  }

  /** Send everything that waits. One replay runs at a time; a second call joins it. */
  const replay = (): Promise<ReplayResult> => (replaying ??= run().finally(() => (replaying = null)));

  /** Calls `l` with the entries a replay found refused for good; returns the way to stop. */
  const onRefused = (l: RefusedListener) => (listeners.add(l), () => void listeners.delete(l));

  return { queueNote, queueCommand, onRefused, replay, waiting, count: async () => (await sendable()).length };
}

export type Outbox = ReturnType<typeof createOutbox>;
