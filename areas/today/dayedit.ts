/** Today's plan edits as ev4's `dayedits` document (schema 1: replaced whole by the page, one per Central date). */
export interface DayEditDoc {
  schema: 1;
  writer: "page";
  at: string;
  source: string;
  updatedAt: string;
  date: string;
  checks?: Record<string, { at: string; by?: string }>;
  added?: Record<string, unknown>;
  skipped?: Record<string, unknown>;
  checkin?: unknown;
}

const iso = (now: Date) => now.toISOString().slice(0, 19) + "Z";

/**
 * The whole document after one tick or un-tick. `prev` is the document as it was read: what it holds besides the
 * check (added items, skips, check-in) is carried over unchanged, because the write replaces the document.
 */
export function buildDayEdit(
  prev: Partial<DayEditDoc> | undefined,
  date: string,
  itemId: string,
  done: boolean,
  now: Date,
): DayEditDoc {
  const at = iso(now);
  const checks = { ...(prev?.checks ?? {}) };
  if (done) checks[itemId] = { at, by: "Matt" };
  else delete checks[itemId];
  return {
    schema: 1,
    writer: "page",
    at,
    source: "v5/today",
    updatedAt: at,
    date,
    checks,
    ...(prev?.added ? { added: prev.added } : {}),
    ...(prev?.skipped ? { skipped: prev.skipped } : {}),
    ...(prev?.checkin !== undefined ? { checkin: prev.checkin } : {}),
  };
}
