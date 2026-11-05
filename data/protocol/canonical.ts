// The one canonical JSON form every document is stored in (§data.protocol).
// It is exactly the text JSON.stringify gives for the value JSON.parse read: compact, keys in the order every reader
// already sees them (integer-like keys first, ascending, then the rest as written). Keys are NOT sorted. Only
// whitespace, escapes and the spelling of numbers change. A number JSON cannot hold (1e400 parses to Infinity, which
// would be stored as null) is refused, so canonicalising never changes the data a reader parses.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Whether every number in v is finite (JSON.parse gives Infinity for a number too large to hold). */
export function finiteJson(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(finiteJson);
  if (isObj(v)) return Object.values(v).every(finiteJson);
  return true;
}

/** The canonical text of a parsed document. */
export const canonicalText = (v: Json): string => JSON.stringify(v);

export type CanonicalResult = { text: string; error?: undefined } | { error: string; text?: undefined };

export const NOT_JSON = 'the body is not JSON';
export const TOO_LARGE = 'a number too large for JSON (it would be stored as null); nothing was written';

/** A body as the store keeps it: {text} (canonical), or {error} when it is not JSON or holds a number JSON cannot. */
export function canonicalJson(text: string): CanonicalResult {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { error: NOT_JSON };
  }
  if (!finiteJson(v)) return { error: TOO_LARGE };
  return { text: canonicalText(v as Json) };
}
