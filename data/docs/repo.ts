// The ev4 write protocol (data/compat) over D1's `docs(c, id, data, at, v)` table. There is no delete path:
// `markDeleted` writes a `deletions(c, id, at)` row (§delete.soft) and removes nothing.
// It imports compat's protocol and canonical files, not its index: the index reaches the frozen schema loader (node:fs),
// which a Worker bundle cannot carry. The checked repository, with ev4's Worker check, is in ./checked.ts.
import {
  canonicalJson,
  canonicalText,
  type Json,
} from "../compat/canonical.ts";
import {
  checkWrites,
  planBatch,
  staleRefusal,
  validCollection,
  validDocId,
  type BatchResult,
  type PlannedRow,
  type ProtocolAdapter,
  type SaveResult,
  type StoredDoc,
  type Write,
  type WriteProblem,
} from "../compat/protocol.ts";
import {
  sizeRefusal,
  sizeWarning,
  DOC_CEILING,
  type SizeWarning,
} from "./budget.ts";
import { parseDeletion } from "../../domain/index.ts";
import type { D1Like, D1Statement } from "./d1.ts";
import {
  type Row,
  stored,
  readRow,
  deletedIds,
  gateProblem,
  titleProblem,
} from "./gate.ts";

/** How far back `changedSince` hands the next `since`, so a write stamped just before a read is read again. */
const OVERLAP_MS = 5000;

export interface DocsOptions {
  /** The Worker clock, in ms. */
  clock: () => number;
  /** An extra per-document write check, run after the gate's own (the gate cannot be switched off, §data.gate). */
  problem?: WriteProblem | null;
  /** Reads include documents with a deletions row (default: hidden, §delete.soft). */
  includeDeleted?: boolean;
  /** Called for each stored row a read leaves out because it does not parse (default: logs). */
  onBad?: (b: { collection: string; doc_id: string; reason: string }) => void;
  /** The platform ceiling for one document, in bytes (default: D1's 2 MB row). */
  ceiling?: number;
  /** Called for each write over 75% of the ceiling; there is no Activity write path yet, so it logs by default. */
  onWarn?: (w: SizeWarning) => void;
}

/** A successful write may carry size warnings (CONTRACT §data.size). */
export type Warned<T> = T extends { ok: true }
  ? T & { warnings?: SizeWarning[] }
  : T;

export interface DocsRepo extends ProtocolAdapter {
  save(
    c: string,
    id: string,
    body: string,
    ifVersion: number | null,
  ): Promise<Warned<SaveResult>>;
  batch(writes: unknown): Promise<Warned<BatchResult>>;
  /** Soft delete: writes the deletions row (the latest delete time wins) and leaves the document. False if none. */
  markDeleted(c: string, id: string): Promise<boolean>;
  /** Change a document's title; a kind with no title is refused with a reason and nothing is written. */
  rename(
    c: string,
    id: string,
    title: string,
    ifVersion: number,
  ): Promise<Warned<SaveResult>>;
}

const SELECT = "SELECT c, id, data, at, v FROM docs";

export function docsRepo(
  db: D1Like,
  {
    clock,
    problem: inner = null,
    includeDeleted = false,
    onBad = (b) =>
      console.warn(
        `bad row left out: ${b.collection}/${b.doc_id}: ${b.reason}`,
      ),
    ceiling = DOC_CEILING,
    onWarn = (w) => console.warn(`doc size: ${w.message}`),
  }: DocsOptions,
): DocsRepo {
  const problem: WriteProblem = (c, id, doc, prev) =>
    sizeRefusal(doc, ceiling) ??
    gateProblem(c, id, doc, prev) ??
    (inner ? inner(c, id, doc, prev) : null);
  const warnings = (rows: { c: string; id: string; data: Json }[]) => {
    const out = rows.flatMap(
      (r) => sizeWarning(r.c, r.id, r.data, ceiling) ?? [],
    );
    out.forEach(onWarn);
    return out.length ? { warnings: out } : {};
  };
  const readable = (r: Row) => readRow(r, onBad);
  const deletedIn = (c: string) =>
    includeDeleted ? Promise.resolve(new Set<string>()) : deletedIds(db, c);
  const one = (c: string, id: string) =>
    db.prepare(`${SELECT} WHERE c = ? AND id = ?`).bind(c, id).first<Row>();

  // The statements writing one planned row. An update that finds its version moved changes nothing, so the guard
  // after it throws and D1 rolls the whole batch back; a create over an existing row hits the primary key.
  const statements = (r: PlannedRow, at: number): D1Statement[] => {
    const text = canonicalText(r.data);
    if (r.from === null)
      return [
        db
          .prepare(
            "INSERT INTO docs (c, id, data, at, v) VALUES (?, ?, ?, ?, 1)",
          )
          .bind(r.c, r.id, text, at),
      ];
    return [
      db
        .prepare(
          "UPDATE docs SET data = ?, at = ?, v = v + 1 WHERE c = ? AND id = ? AND v = ?",
        )
        .bind(text, at, r.c, r.id, r.from),
      db
        .prepare("SELECT CASE WHEN changes() = 0 THEN json('stale') END")
        .bind(),
    ];
  };

  async function plan(ws: Write[]) {
    const current = new Map<string, { v: number; data: Json }>();
    for (const w of ws) {
      const r = await one(w.collection, w.doc_id);
      if (r)
        current.set(w.collection + "\n" + w.doc_id, {
          v: r.v,
          data: JSON.parse(r.data) as Json,
        });
    }
    return planBatch(ws, current, problem);
  }

  return {
    async get(c, id) {
      const r = await one(c, id);
      if (!r || (await deletedIn(c)).has(id)) return null;
      return readable(r);
    },

    async list(c) {
      const { results } = await db
        .prepare(`${SELECT} WHERE c = ? ORDER BY id`)
        .bind(c)
        .all<Row>();
      const gone = await deletedIn(c);
      return results.flatMap((r) =>
        gone.has(r.id) ? [] : (readable(r) ?? []),
      );
    },

    async changedSince(since) {
      const before = clock();
      const { results } = await db
        .prepare(`${SELECT} WHERE at > ? ORDER BY at, c, id`)
        .bind(since)
        .all<Row>();
      return {
        now: Math.max(since, before - OVERLAP_MS),
        docs: results.map(stored),
      };
    },

    async save(c, id, body, ifVersion): Promise<SaveResult> {
      if (
        ifVersion !== null &&
        !(Number.isInteger(ifVersion) && ifVersion >= 1)
      )
        return {
          ok: false,
          status: 400,
          error: "if_version: a whole number from 1",
        };
      const canon = canonicalJson(body);
      if (canon.error !== undefined)
        return { ok: false, status: 400, error: canon.error };
      if (!validCollection(c) || !validDocId(id))
        return {
          ok: false,
          status: 400,
          error: "not a collection and document id",
        };
      const data = JSON.parse(canon.text) as Json;
      const cur = await one(c, id);
      const have = cur ? cur.v : null;
      if (have !== ifVersion) return staleRefusal(c, id, ifVersion, have);
      const bad = problem
        ? problem(c, id, data, cur ? (JSON.parse(cur.data) as Json) : null)
        : null;
      if (bad)
        return {
          ok: false,
          status: 400,
          error: bad + "; nothing was written",
          collection: c,
          doc_id: id,
        };
      const at = clock();
      const row: PlannedRow = {
        c,
        id,
        data,
        from: have,
        v: have == null ? 1 : have + 1,
      };
      try {
        await db.batch(statements(row, at));
      } catch {
        const now = await one(c, id);
        return staleRefusal(c, id, ifVersion, now ? now.v : null);
      }
      return { ok: true, at, version: row.v, ...warnings([row]) };
    },

    async batch(writes): Promise<BatchResult> {
      const wall = checkWrites(writes);
      if (wall) return wall;
      const ws = writes as Write[];
      const first = await plan(ws);
      if (!first.ok) return first;
      const at = clock();
      try {
        await db.batch(first.rows.flatMap((r) => statements(r, at)));
      } catch (e) {
        // Something landed between our read and our write, so nothing was written: say why, as the planner does.
        const again = await plan(ws);
        if (!again.ok) return again;
        throw e;
      }
      return {
        ok: true,
        at,
        results: first.rows.map((r) => ({
          collection: r.c,
          doc_id: r.id,
          version: r.v,
        })),
        ...warnings(first.rows),
      };
    },

    async rename(c, id, title, ifVersion) {
      const why = titleProblem(c, id);
      if (why)
        return {
          ok: false,
          status: 400,
          error: why + "; nothing was written",
          collection: c,
          doc_id: id,
        };
      const cur = await one(c, id);
      if (!cur) return staleRefusal(c, id, ifVersion, null);
      return this.save(
        c,
        id,
        JSON.stringify({ ...(JSON.parse(cur.data) as object), title }),
        ifVersion,
      );
    },

    async markDeleted(c, id) {
      if (!(await one(c, id))) return false;
      const row = parseDeletion({ c, id, at: clock() });
      await db
        .prepare(
          "INSERT INTO deletions (c, id, at) VALUES (?, ?, ?) ON CONFLICT (c, id) DO UPDATE SET at = excluded.at",
        )
        .bind(row.c, row.id, row.at)
        .run();
      return true;
    },
  };
}
