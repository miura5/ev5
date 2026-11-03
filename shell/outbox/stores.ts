// OutboxStore over IndexedDB (name ev5-app, never ev4's ev-app: CONTRACT §data.offline) and over a map for tests.
import type { OutboxEntry, OutboxStore } from './types.ts';

export const IDB_NAME = 'ev5-app';
const BOX = 'outbox';

export function memoryStore(): OutboxStore & { size(): number } {
  const m = new Map<string, OutboxEntry>();
  return {
    all: async () => [...m.values()].map((e) => structuredClone(e)),
    put: async (e) => void m.set(e.key, structuredClone(e)),
    remove: async (key, tag) => void (m.get(key)?.tag === tag && m.delete(key)),
    size: () => m.size,
  };
}

function done<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, no) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}

export function indexedDbStore(factory: IDBFactory = indexedDB): OutboxStore {
  let opened: Promise<IDBDatabase> | null = null;
  const open = () =>
    (opened ??= new Promise<IDBDatabase>((ok, no) => {
      const q = factory.open(IDB_NAME, 1);
      q.onupgradeneeded = () => q.result.createObjectStore(BOX, { keyPath: 'key' });
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    }));
  const store = async (mode: IDBTransactionMode) => (await open()).transaction(BOX, mode).objectStore(BOX);
  return {
    all: async () => done((await store('readonly')).getAll() as IDBRequest<OutboxEntry[]>),
    put: async (e) => void (await done((await store('readwrite')).put(e))),
    remove: async (key, tag) => {
      const s = await store('readwrite');
      const cur = (await done(s.get(key))) as OutboxEntry | undefined;
      if (cur?.tag === tag) await done(s.delete(key));
    },
  };
}
