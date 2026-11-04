// The offline read copy (CONTRACT §data.offline): the last good answer of each read, kept in the ev5-app database
// beside the outbox. A read that works refreshes the copy; a read that fails (no connection) gets the copy back and the
// shell says so. The shell reaches the server only through its own docs reads and commands/client (§drift.imports).
import { done, openAppDb, READS } from "./outbox/index.ts";

export interface CopyStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export function memoryCopyStore(): CopyStore {
  const m = new Map<string, unknown>();
  return {
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : undefined),
    set: async (k, v) => void m.set(k, structuredClone(v)),
  };
}

export function indexedDbCopyStore(factory?: IDBFactory): CopyStore {
  let opened: Promise<IDBDatabase> | null = null;
  const open = () => (opened ??= openAppDb(factory));
  const store = async (mode: IDBTransactionMode) =>
    (await open()).transaction(READS, mode).objectStore(READS);
  return {
    get: async (k) => done((await store("readonly")).get(k)),
    set: async (k, v) =>
      void (await done((await store("readwrite")).put(v, k))),
  };
}

export interface ReadCopy {
  /** Run the read; keep its answer. If it throws, give back the kept answer, or throw if there is none. */
  read<T>(key: string, fetcher: () => Promise<T>): Promise<T>;
  /** True while the last read shown came from the saved copy. */
  usingCopy(): boolean;
  subscribe(fn: () => void): () => void;
}

export function createReadCopy(store: CopyStore): ReadCopy {
  let copy = false;
  const fns = new Set<() => void>();
  const mark = (v: boolean) => {
    if (copy === v) return;
    copy = v;
    fns.forEach((f) => f());
  };
  return {
    async read<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
      try {
        const fresh = await fetcher();
        mark(false);
        await store.set(key, fresh).catch(() => undefined); // a full or blocked store must not fail the read
        return fresh;
      } catch (e) {
        // A refusal (wrong token, server error) is not "offline": only a rejected fetch falls back to the copy.
        if (!(e instanceof TypeError)) throw e;
        const kept = await store.get(key).catch(() => undefined);
        if (kept === undefined) throw e;
        mark(true);
        return kept as T;
      }
    },
    usingCopy: () => copy,
    subscribe: (fn) => (fns.add(fn), () => void fns.delete(fn)),
  };
}
