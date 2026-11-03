import type { Item } from './types.ts';

// Answer options and a matrix's rows are shown shuffled at render, seeded by the set's id and each item's id, never by
// its place, so the order is the same on every reload and after a rebuild. The stored item is untouched: answers stay
// keyed by item id and record the item's own option and row indices, so nothing is remapped. Across a set's
// single-answer items, in the set's order, no three in a row show the right answer at the same place or at places that
// step by one (A, B, C), and a matrix's rows never run 1, 2, 3 down the right columns (the ROME case): each item tries
// its seeded orders in turn and keeps the first that makes no such run, else the one that makes fewest.
const hash32 = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

function seededOrder(n: number, key: string): number[] {
  let a = hash32(key);
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const p = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = p[i] as number;
    p[i] = p[j] as number;
    p[j] = tmp;
  }
  return p;
}

/** How many places in a sequence of positions end a run of three: the same place, or steps of +1 or -1. */
function positionRuns(seq: number[]): number {
  let n = 0;
  for (let i = 2; i < seq.length; i++) {
    const a = (seq[i - 1] ?? 0) - (seq[i - 2] ?? 0);
    const b = (seq[i] ?? 0) - (seq[i - 1] ?? 0);
    if (a === b && Math.abs(a) <= 1) n++;
  }
  return n;
}

const ORDER_TRIES = 40;
/** The first of an item's seeded orders whose sequence (scored by score) makes no run, else the one with fewest. */
function pickOrder(n: number, key: string, score: (p: number[]) => number): number[] {
  let best: number[] = [];
  let bestRuns = Infinity;
  for (let k = 0; k < ORDER_TRIES; k++) {
    const p = seededOrder(n, key + '|' + k);
    const r = score(p);
    if (r < bestRuns) [best, bestRuns] = [p, r];
    if (!r) break;
  }
  return best;
}

export type DisplayOrder = Record<string, { options?: number[]; rows?: number[] }>;

/** The display order of a set's items: {[itemId]: {options: option indexes in the order shown} or {rows: row indexes
 *  in the order shown}}; numeric and open items have none. Items in the set's order. */
export function displayOrder(set: { id?: string } | null | undefined, items: Item[] | null | undefined): DisplayOrder {
  const sid = String(set?.id ?? '');
  const out: DisplayOrder = {};
  const shown: number[] = []; // where the right answer shows, for the single-answer items so far
  for (const q of items || []) {
    if (!q || !q.id) continue;
    const key = sid + '|' + q.id;
    const rows = q.type === 'matrix' && q.matrix && Array.isArray(q.matrix.rows) ? q.matrix.rows : null;
    if (rows) {
      const right = rows.map((r) => r.correct);
      out[q.id] = { rows: pickOrder(rows.length, key + '|rows', (p) => positionRuns(p.map((i) => right[i] ?? 0))) };
      continue;
    }
    if (!Array.isArray(q.options) || q.options.length < 2 || q.type === 'numeric' || q.type === 'open') continue;
    const correct = Array.isArray(q.correct) ? q.correct : [];
    if (correct.length === 1) {
      const p = pickOrder(q.options.length, key + '|options', (p) =>
        positionRuns([...shown.slice(-2), p.indexOf(correct[0] ?? -1)]),
      );
      shown.push(p.indexOf(correct[0] ?? -1));
      out[q.id] = { options: p };
    } else out[q.id] = { options: seededOrder(q.options.length, key + '|options|0') };
  }
  return out;
}

/** A mini quiz's pick from items (one-answer questions, in the set's order) given latest ({[itemId]: newest attempt}):
 *  the lead's unseen first, then the rest unseen, then the seen ones least recently answered first, so a retake
 *  rotates instead of repeating the same few. {pick, fresh: how many of the pick are unseen}. */
export function miniOrder<T extends { id: string }>(
  items: T[],
  latest: Record<string, { at?: string }> | null | undefined,
  { lead = null, n = 5 }: { lead?: ((q: T) => boolean) | null; n?: number } = {},
): { pick: T[]; fresh: number } {
  const ans = latest || {};
  const at = (q: T) => String(ans[q.id]?.at ?? '');
  const mine = lead ? items.filter(lead) : [];
  const rest = items.filter((q) => !mine.includes(q));
  const fresh = (qs: T[]) => qs.filter((q) => !ans[q.id]);
  const seen = (qs: T[]) => qs.filter((q) => ans[q.id]).sort((a, b) => at(a).localeCompare(at(b)));
  const pick = [...fresh(mine), ...fresh(rest), ...seen(mine), ...seen(rest)].slice(0, n);
  return { pick, fresh: pick.filter((q) => !ans[q.id]).length };
}
