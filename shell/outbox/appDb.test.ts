import { expect, test } from "vitest";
import { indexedDbCopyStore } from "../readCopy.ts";
import { indexedDbStore, openAppDb, READS } from "./stores.ts";

// A small hand-written IndexedDB (fake-indexeddb would be a new dependency): databases by name with a version,
// stores with an optional keyPath, requests that answer on a microtask. Enough for open/upgrade/get/put/getAll/delete.
type Store = { keyPath?: string; rows: Map<unknown, unknown> };
type Req = { result?: unknown; error?: unknown; onsuccess?: () => void; onerror?: () => void };
function fakeIdb(): { factory: IDBFactory; dbs: Map<string, { version: number; stores: Map<string, Store> }> } {
  const dbs = new Map<string, { version: number; stores: Map<string, Store> }>();
  const answer = (value: unknown): Req => {
    const r: Req = {};
    queueMicrotask(() => {
      r.result = value;
      r.onsuccess?.();
    });
    return r;
  };
  const factory = {
    open(name: string, version: number) {
      const q: Req & { onupgradeneeded?: () => void } = {};
      queueMicrotask(() => {
        const rec = dbs.get(name) ?? { version: 0, stores: new Map() };
        dbs.set(name, rec);
        const db = {
          get objectStoreNames() {
            return { contains: (n: string) => rec.stores.has(n) };
          },
          createObjectStore(n: string, o?: { keyPath?: string }) {
            rec.stores.set(n, { keyPath: o?.keyPath, rows: new Map() });
          },
          transaction(n: string) {
            const s = rec.stores.get(n);
            if (!s) throw new Error(`no store ${n}`);
            return {
              objectStore: () => ({
                get: (k: unknown) => answer(structuredClone(s.rows.get(k))),
                getAll: () => answer([...s.rows.values()].map((v) => structuredClone(v))),
                put: (v: unknown, k?: unknown) => {
                  const key = s.keyPath ? (v as Record<string, unknown>)[s.keyPath] : k;
                  s.rows.set(key, structuredClone(v));
                  return answer(key);
                },
                delete: (k: unknown) => answer(void s.rows.delete(k)),
              }),
            };
          },
        };
        q.result = db;
        if (rec.version < version) {
          q.onupgradeneeded?.();
          rec.version = version;
        }
        q.onsuccess?.();
      });
      return q;
    },
  };
  return { factory: factory as unknown as IDBFactory, dbs };
}

test("a fresh open makes both stores; a version 1 database keeps its outbox rows through the upgrade", async () => {
  const { factory, dbs } = fakeIdb();
  // The old (version 1) shape: only the outbox store, one waiting entry.
  dbs.set("ev5-app", { version: 1, stores: new Map([["outbox", { keyPath: "key", rows: new Map() }]]) });
  const entry = { key: "notes/a", tag: "t" } as never;
  dbs.get("ev5-app")!.stores.get("outbox")!.rows.set("notes/a", entry);
  const db = await openAppDb(factory);
  expect(dbs.get("ev5-app")!.version).toBe(2);
  expect(db.objectStoreNames.contains(READS)).toBe(true);
  expect(await indexedDbStore(factory).all()).toEqual([entry]);
});

test("the copy store keeps a value across a reopen and gives undefined for an unknown key", async () => {
  const { factory } = fakeIdb();
  const a = indexedDbCopyStore(factory);
  expect(await a.get("docs:notes")).toBeUndefined();
  await a.set("docs:notes", [{ id: "x", v: 1 }]);
  await a.set("docs:notes", [{ id: "x", v: 2 }]);
  expect(await indexedDbCopyStore(factory).get("docs:notes")).toEqual([{ id: "x", v: 2 }]);
});

test("the outbox and the copy store share one database without touching each other", async () => {
  const { factory } = fakeIdb();
  const box = indexedDbStore(factory);
  await box.put({ key: "k", tag: "t" } as never);
  await indexedDbCopyStore(factory).set("k", "copy");
  expect(await box.all()).toHaveLength(1);
  expect(await indexedDbCopyStore(factory).get("k")).toBe("copy");
});
