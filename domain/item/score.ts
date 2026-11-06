import type { Item, ItemType } from './types.ts';

/** The shape of an item: its own type, else select-all when more than one answer is right, else single. */
export function itemType(q: Pick<Item, 'type' | 'correct'> | null | undefined): ItemType {
  if (q?.type) return q.type;
  return Array.isArray(q?.correct) && q.correct.length > 1 ? 'multi_select' : 'single';
}

/** A number answer as given: a number, text ("2.5" or "2.5 cm") or {value, unit}; null when it holds no number. */
export function numberAnswer(given: unknown): { value: number; unit: string | null } | null {
  if (given && typeof given === 'object' && !Array.isArray(given)) {
    const g = given as { value?: unknown; unit?: unknown };
    return typeof g.value === 'number' && Number.isFinite(g.value)
      ? { value: g.value, unit: g.unit ? String(g.unit) : null }
      : null;
  }
  if (typeof given === 'number') return Number.isFinite(given) ? { value: given, unit: null } : null;
  const m = String(given ?? '')
    .trim()
    .match(/^(-?\d+(?:\.\d+)?|-?\.\d+)\s*(.*)$/);
  return m ? { value: Number(m[1]), unit: m[2] || null } : null;
}

/** Units compare as free text, without case or spaces: "km/h" is "KM / h". */
const unitKey = (u: unknown): string =>
  String(u ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');

export type Scored = { correct: boolean; score: number };

/**
 * Scores an answer. chosen: option indexes (single, select all), one column index per row (grid), or the number
 * given (right within the item's tolerance; a unit given must be the item's). Select all is plus/minus scored, floored
 * at 0. An open answer is kept for grading later, so it is never scored here.
 */
export function scoreAnswer(q: Item, chosen: unknown): Scored {
  const t = itemType(q);
  if (t === 'open') throw new Error('an open answer is not scored here');
  if (t === 'numeric') {
    const g = numberAnswer(chosen);
    const tol = typeof q.tolerance === 'number' && q.tolerance > 0 ? q.tolerance : 0;
    const unitOk = !g?.unit || !q.unit || unitKey(g.unit) === unitKey(q.unit);
    const correct = !!g && unitOk && Math.abs(g.value - (q.answer ?? NaN)) <= tol + 1e-9;
    return { correct, score: correct ? 1 : 0 };
  }
  const picked: unknown[] = Array.isArray(chosen) ? chosen : [];
  if (t === 'grid') {
    const rows = q.grid?.rows ?? [];
    const right = rows.filter((r, i) => picked[i] === r.correct).length;
    return { correct: rows.length > 0 && right === rows.length, score: rows.length ? right / rows.length : 0 };
  }
  const key = [...(q.correct ?? [])].sort((a, b) => a - b);
  const got = [...new Set(picked.filter((x): x is number => typeof x === 'number'))].sort((a, b) => a - b);
  const correct = key.length === got.length && key.every((v, i) => v === got[i]);
  if (t === 'single') return { correct, score: correct ? 1 : 0 };
  const hits = got.filter((i) => key.includes(i)).length;
  return { correct, score: key.length ? Math.max(0, hits - (got.length - hits)) / key.length : 0 };
}
