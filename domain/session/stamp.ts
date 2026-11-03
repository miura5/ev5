import type { SessionEvent } from './types.ts';

const KEY_TIME = /-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(\d{3})?(?:-[a-z0-9]+)?$/;

/** An instant or date as milliseconds: NaN when missing or unreadable; a bare date is noon UTC. */
export function toMs(x: string | number | Date | null | undefined): number {
  if (x == null) return NaN;
  if (typeof x === 'number') return x;
  if (x instanceof Date) return x.getTime();
  return Date.parse(x.length === 10 ? `${x}T12:00:00Z` : x);
}

export const isoOf = (x?: string | number | Date | null): string => new Date(x ?? Date.now()).toISOString();

/** When an event happened: its own `at`, else the time in its key, else the key itself. */
export function entryTime(key: string, e: Pick<SessionEvent, 'at'> | undefined): string {
  if (e?.at) return e.at;
  const m = KEY_TIME.exec(key);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7] ?? '000'}Z` : key;
}

/** FNV-1a, for change detection only. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
