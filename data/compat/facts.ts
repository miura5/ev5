// ev4's rules for what a write may change in a document that exists (ev4 core/run.mjs, core/lint.mjs, core/derive.mjs):
//   - A Fact's own fields are write-once: once set, never changed or removed. A field it does not have yet may be
//     set (a first write). `at` is the envelope's time and may change.
//   - A mark is a Fact field changed in place, but only by a role the mark names (dates.date: canvas-sync only).
//   - An append map only gains entries, keyed `<writer>-<YYYYMMDD-HHMMSS[mmm]>[-n]` (talk: `m-<time>-<by>`), and each
//     new entry's writer must be one the map names. answers/<set>.answers nests one level: item id, then attempts.
//   - A note's createdAt and earlierOf are its identity: never changed, added or removed once the note exists.
// So an ev4 set (a Fact with no marks and no append maps) is immutable once written.
import type { Json } from './canonical.ts';
import { loadCollections } from './frozen.ts';

const isObj = (v: unknown): v is Record<string, Json> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** JSON with every object's keys sorted, so two values compare equal whatever their key order. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (isObj(v))
    return (
      '{' +
      Object.keys(v)
        .sort()
        .map(k => JSON.stringify(k) + ':' + stableStringify(v[k]))
        .join(',') +
      '}'
    );
  return v === undefined ? 'undefined' : JSON.stringify(v);
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);

const EVENT_KEY = /^([a-z][a-z-]*)-\d{8}-\d{6}(?:\d{3})?(?:-[a-z0-9]+)?$/;
const TALK_KEY = /^m-\d{8}-\d{6}(?:\d{3})?-([a-z]+)$/;
/** Who appended an entry, from its key; null when the key is not an append key (the schema reports it). */
export function keyWriter(collection: string, field: string, key: string): string | null {
  if (collection === 'talk' && field === 'messages') {
    const m = TALK_KEY.exec(key);
    return m ? (m[1] === 'job' ? 'worker' : 'page') : null;
  }
  const m = EVENT_KEY.exec(key);
  return m ? m[1] : null;
}
const appendDepth = (collection: string, field: string) => (collection === 'answers' && field === 'answers' ? 2 : 1);

/** Every entry of an append map as [path, key, value], at its depth. */
function entries(value: unknown, depth: number, prefix = ''): [string, string, Json][] {
  if (!isObj(value)) return [];
  if (depth <= 1) return Object.entries(value).map(([k, v]) => [prefix + k, k, v]);
  return Object.entries(value).flatMap(([k, v]) => entries(v, depth - 1, prefix + k + '.'));
}

/** The problems with writing `doc` over `prev` (null: a create), as "path: reason" lines. */
export function changeProblems(
  collection: string,
  doc: Record<string, Json>,
  prev: Record<string, Json> | null,
  { id, role }: { id?: string; role: string }
): string[] {
  const c = loadCollections().collections[collection];
  if (!c) return [];
  const own = id !== undefined ? c.documents?.[id] : undefined;
  const cls = own ? own.class : c.class;
  const appends = own ? {} : (c.appends ?? {});
  const marks = own ? {} : (c.marks ?? {});
  const out: string[] = [];

  for (const [field, allowed] of Object.entries(appends)) {
    const depth = appendDepth(collection, field);
    const was = new Map(entries(prev?.[field], depth).map(([p, , v]) => [p, v]));
    const now = new Map(entries(doc[field], depth).map(([p, k, v]) => [p, { k, v }]));
    for (const [p, v] of was) {
      if (!now.has(p)) out.push(`/${field}/${p}: an append entry is never removed`);
      else if (!same(now.get(p)!.v, v)) out.push(`/${field}/${p}: an append entry is never changed`);
    }
    for (const [p, { k }] of now) {
      if (was.has(p)) continue;
      const by = keyWriter(collection, field, k);
      if (by && !allowed.includes(by))
        out.push(`/${field}/${p}: appended by ${by}; ${field} is appended by ${allowed.join(', ')}`);
    }
  }

  if (!prev) return out;
  if (cls === 'Fact') {
    for (const [k, v] of Object.entries(prev)) {
      if (k === 'at' || k in appends || k in marks) continue;
      if (!(k in doc)) out.push(`/${k}: write-once on a Fact; it is never removed`);
      else if (!same(doc[k], v)) out.push(`/${k}: write-once on a Fact (not a mark); it is never changed`);
    }
    for (const [k, roles] of Object.entries(marks))
      if (!same(doc[k], prev[k]) && !roles.includes(role))
        out.push(`/${k}: a mark ${roles.join(', ')} changes, not ${role}`);
  }
  // The Fact rule above already refuses changing or removing them; a note may not gain them later either.
  if (collection === 'notes')
    for (const k of ['createdAt', 'earlierOf'])
      if (k in doc && !(k in prev)) out.push(`/${k}: written once, when the note is made; it is never added later`);
  return out;
}
