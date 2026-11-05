// The write protocol (CONTRACT §data.protocol) over D1's `docs(c, id, data, at, v)` table, as pure functions plus the
// interface every repository over that table implements.
//   - v is 1 when a document is created and one more on every write; at is the server clock (ms) of the write.
//   - A write to a document that exists names the version it read (if_version); a create names none. Anything else
//     writes nothing and answers 409 with the current version.
//   - A batch is 1 to 50 writes, all or nothing, each document at most once, sharing one `at`.
//   - There is no delete: a delete op is refused with 403 and the batch writes nothing.
import { finiteJson, type Json } from './canonical.ts';

export const MAX_WRITES = 50;
export const MAX_BODY = 1024 * 1024;
export const NO_DELETE = 'the store never deletes: a delete is refused, and nothing was written';

/** One stored row of `docs`. `text` is the canonical JSON the row holds; `data` is that text parsed. */
export interface StoredDoc {
  c: string;
  id: string;
  text: string;
  data: Json;
  at: number;
  v: number;
}

export interface Write {
  op: 'set' | 'update' | string;
  collection: string;
  doc_id: string;
  data: unknown;
  if_version?: number | null;
}

export interface Refusal {
  ok: false;
  status: 400 | 403 | 409 | 413;
  error: string;
  entry?: number;
  collection?: string;
  doc_id?: string;
  if_version?: number | null;
  current_version?: number | null;
}

export type SaveResult = { ok: true; at: number; version: number } | Refusal;
export type BatchResult =
  | { ok: true; at: number; results: { collection: string; doc_id: string; version: number }[] }
  | Refusal;

/** null when a write leaving `doc` (prev: as stored, null for a create) is sound, else the reason in one line. */
export type WriteProblem = (collection: string, id: string, doc: Json, prev: Json | null) => string | null;

/**
 * What a repository over the `docs` table must do. There is deliberately no delete, remove or purge method
 * (§delete.soft). `save` writes one whole body as text, pinned to `ifVersion`; `batch` is all or nothing.
 */
export interface ProtocolAdapter {
  get(c: string, id: string): Promise<StoredDoc | null>;
  /** One collection, ordered by id. */
  list(c: string): Promise<StoredDoc[]>;
  /** Every document whose at is after `since`, and the next `since` to ask with (a few seconds back, never skipping). */
  changedSince(since: number): Promise<{ now: number; docs: StoredDoc[] }>;
  save(c: string, id: string, body: string, ifVersion: number | null): Promise<SaveResult>;
  batch(writes: unknown): Promise<BatchResult>;
}

// An id is 1 to 200 characters with no "/", no control character, and not "." or "..". A collection path is an odd
// number (1 to 15) of such segments.
const SEG = '(?!\\.\\.?(?:/|$))[^/\\u0000-\\u001f\\u007f]{1,200}';
const COLLECTION = new RegExp(`^${SEG}(?:/${SEG}){0,14}$`);
const DOC_ID = new RegExp(`^${SEG}$`);

export const validCollection = (c: unknown): c is string =>
  typeof c === 'string' && c.length <= 1000 && COLLECTION.test(c) && c.split('/').length % 2 === 1;
export const validDocId = (id: unknown): id is string => typeof id === 'string' && DOC_ID.test(id);

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDel = (v: unknown): boolean => isObj(v) && v.__delete__ === true && Object.keys(v).length === 1;
const hasDel = (v: unknown): boolean =>
  isDel(v) ? true : Array.isArray(v) ? v.some(hasDel) : isObj(v) && Object.values(v).some(hasDel);

/** update: `patch` merged into `doc`, objects deeply, arrays and values replaced; {"__delete__": true} removes. */
export function merge(doc: unknown, patch: Record<string, unknown>): Record<string, Json> {
  const out: Record<string, unknown> = isObj(doc) ? { ...doc } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (isDel(v)) delete out[k];
    else if (isObj(v)) out[k] = merge(out[k], v);
    else out[k] = v;
  }
  return out as Record<string, Json>;
}

const refuse = (status: Refusal['status'], error: string, entry?: number): Refusal =>
  entry === undefined ? { ok: false, status, error } : { ok: false, status, error, entry };

/** A batch's own walls, before anything is read: null when sound, else the refusal. */
export function checkWrites(writes: unknown): Refusal | null {
  if (!Array.isArray(writes) || writes.length < 1 || writes.length > MAX_WRITES)
    return refuse(400, `writes: 1 to ${MAX_WRITES} entries`);
  const seen = new Set<string>();
  for (let i = 0; i < writes.length; i++) {
    const w: unknown = writes[i];
    if (!isObj(w)) return refuse(400, 'an entry is an object', i);
    if (w.op === 'delete') return refuse(403, NO_DELETE, i);
    if (w.op !== 'set' && w.op !== 'update') return refuse(400, `op: set or update, not ${JSON.stringify(w.op)}`, i);
    if (!validCollection(w.collection)) return refuse(400, 'collection: not a collection path', i);
    if (!validDocId(w.doc_id)) return refuse(400, 'doc_id: not a document id', i);
    if (!isObj(w.data)) return refuse(400, 'data: a JSON object', i);
    if (w.op === 'set' && hasDel(w.data)) return refuse(400, 'set rejects {"__delete__": true}; use update', i);
    if (!finiteJson(w.data)) return refuse(400, 'data: a number too large for JSON (it would be stored as null)', i);
    const iv = w.if_version;
    if (iv != null && !(Number.isInteger(iv) && (iv as number) >= 1))
      return refuse(400, 'if_version: a whole number from 1', i);
    const key = w.collection + '\n' + w.doc_id;
    if (seen.has(key)) return refuse(400, 'each document is addressed at most once in a batch', i);
    seen.add(key);
  }
  return null;
}

export interface PlannedRow {
  c: string;
  id: string;
  data: Json;
  /** The version the row must still have when written (null: it must not exist). */
  from: number | null;
  v: number;
}

/** The 409 for a pin that does not hold, naming the entry and the current version. */
export function staleRefusal(c: string, id: string, want: number | null, have: number | null, entry?: number): Refusal {
  const who = entry === undefined ? `${c}/${id}` : `entry ${entry} (${c}/${id})`;
  const error =
    have == null
      ? `${who} is pinned to version ${want}, but the document does not exist; nothing was written`
      : want == null
        ? `${who} exists at version ${have} and carries no if_version: read it first; nothing was written`
        : `${who} is pinned to version ${want}, but it is now at version ${have}; nothing was written`;
  const r: Refusal = { ok: false, status: 409, error, collection: c, doc_id: id, if_version: want, current_version: have };
  if (entry !== undefined) r.entry = entry;
  return r;
}

/**
 * The batch planned against what the store holds now (`current`: key "c\nid" -> {v, data}). Every row, or the first
 * refusal. Nothing is written here.
 */
export function planBatch(
  writes: Write[],
  current: Map<string, { v: number; data: Json }>,
  problem: WriteProblem | null
): { ok: true; rows: PlannedRow[] } | Refusal {
  const rows: PlannedRow[] = [];
  for (let i = 0; i < writes.length; i++) {
    const w = writes[i] as Write;
    const cur = current.get(w.collection + '\n' + w.doc_id) ?? null;
    const have = cur ? cur.v : null;
    const want = w.if_version == null ? null : w.if_version;
    if (have !== want) return staleRefusal(w.collection, w.doc_id, want, have, i);
    const data: Json =
      w.op === 'set' ? (w.data as Json) : merge(cur ? cur.data : {}, w.data as Record<string, unknown>);
    const bad = problem ? problem(w.collection, w.doc_id, data, cur ? cur.data : null) : null;
    if (bad) return refuse(400, `entry ${i}: ${bad}; nothing was written`, i);
    rows.push({ c: w.collection, id: w.doc_id, data, from: have, v: have == null ? 1 : have + 1 });
  }
  return { ok: true, rows };
}
