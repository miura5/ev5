// The reference ProtocolAdapter: ev4's `docs` table held in memory, with ev4's Worker semantics (pwa/worker.js for
// the page's save, pwa/runapi.js for the batch). Every v5 repository over D1 must pass the same suite
// (protocol-suite.ts) that this one passes.
import { canonicalJson, canonicalText, type Json } from './canonical.ts';
import {
  checkWrites,
  planBatch,
  staleRefusal,
  validCollection,
  validDocId,
  type BatchResult,
  type ProtocolAdapter,
  type SaveResult,
  type StoredDoc,
  type Write,
  type WriteProblem,
} from './protocol.ts';

/** How far back `changedSince` hands the next `since`, so a write stamped just before a read is read again. */
export const OVERLAP_MS = 5000;

export interface MemoryAdapterOptions {
  /** The server clock, in ms. */
  clock?: () => number;
  /** The per-document check ev4's Worker runs on every write path (notes, in ev4). */
  problem?: WriteProblem | null;
}

const key = (c: string, id: string) => c + '\n' + id;

export function memoryAdapter({ clock = Date.now, problem = null }: MemoryAdapterOptions = {}): ProtocolAdapter {
  const rows = new Map<string, StoredDoc>();
  const copy = (r: StoredDoc): StoredDoc => ({ ...r, data: JSON.parse(r.text) as Json });
  const put = (c: string, id: string, data: Json, at: number, v: number) => {
    const text = canonicalText(data);
    rows.set(key(c, id), { c, id, text, data: JSON.parse(text) as Json, at, v });
  };

  return {
    async get(c, id) {
      const r = rows.get(key(c, id));
      return r ? copy(r) : null;
    },

    async list(c) {
      return [...rows.values()]
        .filter(r => r.c === c)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(copy);
    },

    async changedSince(since) {
      const before = clock();
      const docs = [...rows.values()].filter(r => r.at > since).map(copy);
      return { now: Math.max(since, before - OVERLAP_MS), docs };
    },

    async save(c, id, body, ifVersion): Promise<SaveResult> {
      if (ifVersion !== null && !(Number.isInteger(ifVersion) && ifVersion >= 1))
        return { ok: false, status: 400, error: 'if_version: a whole number from 1' };
      const canon = canonicalJson(body);
      if (canon.error !== undefined) return { ok: false, status: 400, error: canon.error };
      if (!validCollection(c) || !validDocId(id))
        return { ok: false, status: 400, error: 'not a collection and document id' };
      const data = JSON.parse(canon.text) as Json;
      const cur = rows.get(key(c, id)) ?? null;
      const have = cur ? cur.v : null;
      if (have !== ifVersion) return staleRefusal(c, id, ifVersion, have);
      const bad = problem ? problem(c, id, data, cur ? cur.data : null) : null;
      if (bad) return { ok: false, status: 400, error: bad + '; nothing was written', collection: c, doc_id: id };
      const at = clock();
      const v = have == null ? 1 : have + 1;
      put(c, id, data, at, v);
      return { ok: true, at, version: v };
    },

    async batch(writes): Promise<BatchResult> {
      const wall = checkWrites(writes);
      if (wall) return wall;
      const ws = writes as Write[];
      const current = new Map<string, { v: number; data: Json }>();
      for (const w of ws) {
        const r = rows.get(key(w.collection, w.doc_id));
        if (r) current.set(key(r.c, r.id), { v: r.v, data: JSON.parse(r.text) as Json });
      }
      const plan = planBatch(ws, current, problem);
      if (!plan.ok) return plan;
      // Planned and written with no await between, so nothing can land in between: all or nothing.
      const at = clock();
      for (const r of plan.rows) put(r.c, r.id, r.data, at, r.v);
      return { ok: true, at, results: plan.rows.map(r => ({ collection: r.c, doc_id: r.id, version: r.v })) };
    },
  };
}
