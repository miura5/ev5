// D1 repository over ev4's `docs(c, id, data, at, v)` table: the ProtocolAdapter of data/compat on a real database.
// Every write is one D1 batch (one transaction). Each row is guarded by a statement that raises an error when its
// version pin no longer holds, so a write that lost a race rolls the whole batch back and is planned again.
import { z } from 'zod';
import {
  canonicalJson,
  canonicalText,
  checkWrites,
  ev4WorkerProblem,
  OVERLAP_MS,
  planBatch,
  staleRefusal,
  validCollection,
  validDocId,
  type BatchResult,
  type Json,
  type PlannedRow,
  type ProtocolAdapter,
  type Refusal,
  type SaveResult,
  type StoredDoc,
  type Write,
  type WriteProblem,
} from '../compat/index.ts';

/** The few D1 calls the repository makes (Cloudflare's D1Database fits it). */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = unknown>(): Promise<{ results: T[] }>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

export interface D1DocsOptions {
  /** The Worker clock, in ms. */
  clock?: () => number;
  /** The per-document check run on every write; ev4's Worker check (notes) by default. */
  problem?: WriteProblem | null;
}

const Row = z.object({
  c: z.string(),
  id: z.string(),
  data: z.string(),
  at: z.number().int(),
  v: z.number().int().min(1),
});

const toDoc = (raw: unknown): StoredDoc => {
  const r = Row.parse(raw);
  return { c: r.c, id: r.id, text: r.data, data: JSON.parse(r.data) as Json, at: r.at, v: r.v };
};

const COLS = 'c, id, data, at, v';
// abs(-2^63) overflows in SQLite: the one error a guard raises when its pin does not hold.
const FAIL = 'abs(-9223372036854775808)';
const TRIES = 3;

type Plan = { ok: true; rows: PlannedRow[] } | Refusal;

export function d1Docs(
  db: D1Like,
  { clock = Date.now, problem = ev4WorkerProblem }: D1DocsOptions = {}
): ProtocolAdapter {
  const rows = async (sql: string, ...args: unknown[]) =>
    (await db.prepare(sql).bind(...args).all()).results.map(toDoc);
  const get = async (c: string, id: string) =>
    (await rows(`SELECT ${COLS} FROM docs WHERE c = ? AND id = ?`, c, id))[0] ?? null;

  const statements = (plan: PlannedRow[], at: number): D1Statement[] => {
    const guards = plan.map(r =>
      r.from == null
        ? db.prepare(`SELECT ${FAIL} WHERE EXISTS (SELECT 1 FROM docs WHERE c = ? AND id = ?)`).bind(r.c, r.id)
        : db
            .prepare(`SELECT ${FAIL} WHERE NOT EXISTS (SELECT 1 FROM docs WHERE c = ? AND id = ? AND v = ?)`)
            .bind(r.c, r.id, r.from)
    );
    const writes = plan.map(r =>
      r.from == null
        ? db.prepare('INSERT INTO docs (c, id, data, at, v) VALUES (?, ?, ?, ?, 1)').bind(r.c, r.id, canonicalText(r.data), at)
        : db
            .prepare('UPDATE docs SET data = ?, at = ?, v = ? WHERE c = ? AND id = ? AND v = ?')
            .bind(canonicalText(r.data), at, r.v, r.c, r.id, r.from)
    );
    return [...guards, ...writes];
  };

  /** Plans against what the table holds now and writes it; a pin lost in between plans again, and answers the truth. */
  const commit = async (
    keys: [string, string][],
    plan: (cur: Map<string, { v: number; data: Json }>) => Plan,
    tries = TRIES
  ): Promise<{ ok: true; at: number; rows: PlannedRow[] } | Refusal> => {
    const cur = new Map<string, { v: number; data: Json }>();
    for (const [c, id] of keys) {
      const r = await get(c, id);
      if (r) cur.set(c + '\n' + id, { v: r.v, data: r.data });
    }
    const p = plan(cur);
    if (!p.ok) return p;
    const at = clock();
    try {
      await db.batch(statements(p.rows, at));
    } catch (e) {
      if (tries > 1) return commit(keys, plan, tries - 1);
      throw e;
    }
    return { ok: true, at, rows: p.rows };
  };

  return {
    get,
    list: c => rows(`SELECT ${COLS} FROM docs WHERE c = ? ORDER BY id`, c),

    async changedSince(since) {
      const before = clock();
      const docs = await rows(`SELECT ${COLS} FROM docs WHERE at > ? ORDER BY at, c, id`, since);
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
      const r = await commit([[c, id]], cur => {
        const have = cur.get(c + '\n' + id) ?? null;
        if ((have ? have.v : null) !== ifVersion) return staleRefusal(c, id, ifVersion, have ? have.v : null);
        const bad = problem ? problem(c, id, data, have ? have.data : null) : null;
        if (bad) return { ok: false, status: 400, error: bad + '; nothing was written', collection: c, doc_id: id };
        return { ok: true, rows: [{ c, id, data, from: have ? have.v : null, v: have ? have.v + 1 : 1 }] };
      });
      return r.ok ? { ok: true, at: r.at, version: r.rows[0].v } : r;
    },

    async batch(writes): Promise<BatchResult> {
      const wall = checkWrites(writes);
      if (wall) return wall;
      const ws = writes as Write[];
      const r = await commit(
        ws.map((w): [string, string] => [w.collection, w.doc_id]),
        cur => planBatch(ws, cur, problem)
      );
      if (!r.ok) return r;
      return { ok: true, at: r.at, results: r.rows.map(x => ({ collection: x.c, doc_id: x.id, version: x.v })) };
    },
  };
}
