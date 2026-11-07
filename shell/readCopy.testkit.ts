// An in-memory CopyStore for tests; the app uses indexedDbCopyStore.
import type { CopyStore } from "./readCopy.ts";

export function memoryCopyStore(): CopyStore {
  const m = new Map<string, unknown>();
  return {
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : undefined),
    set: async (k, v) => void m.set(k, structuredClone(v)),
  };
}
