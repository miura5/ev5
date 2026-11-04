// validateWrite: whether a document v5 is about to write to one of ev4's collections is one ev4 would accept, and one
// that keeps ev4 able to read the record after a rollback (PLAN §5.2, §5.3). The checks, in order:
//   1. the collection is one of ev4's 36 (an unknown collection is refused, never passed);
//   2. `writer` is one of the collection's existing writer values (a new value would be a new enum value);
//   3. `source` names v5 (starts with "v5") on a create or a whole rewrite (not sessions: ev4 freezes its enum); a Fact keeps the envelope it was made with;
//   4. the frozen schema, judged as ev4 judges it (schema-check.ts), so no new field or enum value gets through;
//   5. ev4's size cap on one document (the UTF-8 bytes of its JSON);
//   6. given the stored document (`prev`), ev4's rules for changing one: see facts.ts.
import type { Json } from './canonical.ts';
import { loadCollections } from './frozen.ts';
import { schemaErrors } from './schema-check.ts';
import { changeProblems } from './facts.ts';
import type { WriteProblem } from './protocol.ts';

export interface WriteOptions {
  /** The document id: picks the document's own shape and rules where ev4 lists one (talk/memory, system/spec). */
  id?: string;
  /** The document as stored now; omit (or null) for a create. */
  prev?: unknown;
  /** The existing writer role v5 writes as, which a mark's roles are checked against. Default "page". */
  role?: string;
}

export type WriteVerdict = { ok: true } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, Json> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The UTF-8 size a document is stored at. */
export const docBytes = (doc: unknown): number => new TextEncoder().encode(JSON.stringify(doc)).length;

/** Who may write collection (or its document id), per ev4's spec. */
export function writersOf(collection: string, id?: string): string[] {
  const c = loadCollections().collections[collection];
  if (!c) return [];
  const d = id !== undefined ? c.documents?.[id] : undefined;
  return (d ?? c).writers;
}

/** Collections whose `source` enum ev4 froze to its own values; v5 writes "E.V. Home" there (B-834). */
const SOURCE_FROZEN: ReadonlySet<string> = new Set(['sessions']);

export function validateWrite(
  collection: string,
  doc: unknown,
  { id, prev = null, role = 'page' }: WriteOptions = {}
): WriteVerdict {
  const rules = loadCollections();
  const c = Object.hasOwn(rules.collections, collection) ? rules.collections[collection] : null;
  if (!c) return { ok: false, errors: [`(collection): ${collection} is not an ev4 collection; v5 writes it nowhere`] };
  if (!isObj(doc)) return { ok: false, errors: ['(document): a JSON object'] };

  const errors: string[] = [];
  const writers = writersOf(collection, id);
  if (!writers.length) errors.push(`/writer: no one writes ${collection}`);
  else if (typeof doc.writer !== 'string' || !writers.includes(doc.writer))
    errors.push(`/writer: ${JSON.stringify(doc.writer)} is not an existing writer of ${collection} (${writers.join(', ')})`);
  // An update to a Fact keeps the envelope it was made with (its writer and source are write-once).
  const old = isObj(prev) ? prev : null;
  const keepsEnvelope = old !== null && (c.documents?.[id ?? '']?.class ?? c.class) === 'Fact';
  if (!keepsEnvelope && !SOURCE_FROZEN.has(collection) && (typeof doc.source !== 'string' || !doc.source.startsWith('v5')))
    errors.push(`/source: names v5 (starts with "v5"), not ${JSON.stringify(doc.source)}`);

  errors.push(...schemaErrors(collection, doc, id));

  const size = docBytes(doc);
  if (size > rules.documentBytes) errors.push(`(document): ${size} bytes, over ev4's ${rules.documentBytes}-byte cap`);

  errors.push(...changeProblems(collection, doc, old, { id, role }));
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * The check ev4's Worker itself runs on every write path, page save and batch alike: a note must fit the notes
 * schema and the size cap, and its createdAt and earlierOf never change once it exists. Other collections pass.
 * This is what a v5 repository over `docs` refuses with 400 (protocol-suite.ts).
 */
export const ev4WorkerProblem: WriteProblem = (collection, id, doc, prev) => {
  if (collection !== 'notes') return null;
  const bad = schemaErrors('notes', doc, id);
  if (bad.length) return `notes/${id} does not fit its shape: ${bad[0]}`;
  const size = docBytes(doc);
  const cap = loadCollections().documentBytes;
  if (size > cap) return `notes/${id} is ${size} bytes; a note holds at most ${cap}`;
  if (isObj(prev) && isObj(doc))
    for (const k of ['createdAt', 'earlierOf'])
      if (JSON.stringify(prev[k]) !== JSON.stringify(doc[k]))
        return `notes/${id}: ${k} is written once, when the note is made, and never changed`;
  return null;
};
