// OutboxStore over IndexedDB (name ev5-app, never the old app's ev-app: CONTRACT §data.offline) and over a map for tests.
import type { OutboxEntry, OutboxStore } from "./types.ts";

export const IDB_NAME = "ev5-app";
const BOX = "outbox";
export const READS = "reads";

export function memoryStore(): OutboxStore & { size(): number } {
  const m = new Map<string, OutboxEntry>();
  return {
    all: async () => [...m.values()].map((e) => structuredClone(e)),
    put: async (e) => void m.set(e.key, structuredClone(e)),
    remove: async (key, tag) => void (m.get(key)?.tag === tag && m.delete(key)),
    size: () => m.size,
  };
}

export function done<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, no) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}

/** The one ev5-app database: version 2 adds the read copy beside the outbox and leaves the outbox store as it is. */
export function openAppDb(factory?: IDBFactory): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((ok, no) => {
    const q = (factory ?? indexedDB).open(IDB_NAME, 2);
    q.onupgradeneeded = () => {
      const db = q.result;
      if (!db.objectStoreNames.contains(BOX))
        db.createObjectStore(BOX, { keyPath: "key" });
      if (!db.objectStoreNames.contains(READS)) db.createObjectStore(READS);
    };
    q.onsuccess = () => ok(q.result);
    q.onerror = () => no(q.error);
  });
}

export function indexedDbStore(
  factory?: IDBFactory,
  db?: () => Promise<IDBDatabase>,
): OutboxStore {
  let opened: Promise<IDBDatabase> | null = null;
  const open = () => (opened ??= db ? db() : openAppDb(factory));
  const store = async (mode: IDBTransactionMode) =>
    (await open()).transaction(BOX, mode).objectStore(BOX);
  return {
    all: async () =>
      done((await store("readonly")).getAll() as IDBRequest<OutboxEntry[]>),
    put: async (e) => void (await done((await store("readwrite")).put(e))),
    remove: async (key, tag) => {
      const s = await store("readwrite");
      const cur = (await done(s.get(key))) as OutboxEntry | undefined;
      if (cur?.tag === tag) await done(s.delete(key));
    },
  };
}
