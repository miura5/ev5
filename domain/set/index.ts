import type { Chosen, SetAnswers, SetItem, StudySet } from './types.ts';
export * from './types.ts';
export { parseSet } from './parse.ts';

/** The shape of an item: its own type, else select-all when more than one answer is right, else single. */
export function itemType(q: SetItem): NonNullable<SetItem['type']> {
  if (q.type) return q.type;
  return Array.isArray(q.correct) && q.correct.length > 1 ? 'sata' : 'single';
}

/**
 * Scores a single, select-all or matrix answer (ev4 scoreAnswer). Select-all is plus/minus scored, floored at 0.
 * Numeric and open items are graded by their own rules, not here.
 */
export function scoreAnswer(q: SetItem, chosen: Chosen): { correct: boolean; score: number } {
  if (itemType(q) === 'matrix') {
    const rows = q.matrix?.rows ?? [];
    const right = rows.filter((r, i) => chosen[i] === r.correct).length;
    return {
      correct: rows.length > 0 && right === rows.length,
      score: rows.length ? right / rows.length : 0,
    };
  }
  const key = [...(q.correct ?? [])].sort((a, b) => a - b);
  const got = [...new Set(chosen)].sort((a, b) => a - b);
  const correct = key.length === got.length && key.every((v, i) => v === got[i]);
  if (itemType(q) === 'single') return { correct, score: correct ? 1 : 0 };
  const hits = got.filter((i) => key.includes(i)).length;
  return {
    correct,
    score: key.length ? Math.max(0, hits - (got.length - hits)) / key.length : 0,
  };
}

/** Ids of the items with at least one attempt. */
export function answeredItems(set: StudySet, answers: SetAnswers): string[] {
  return set.items.filter((q) => Object.keys(answers[q.id] ?? {}).length > 0).map((q) => q.id);
}

/** A set is done once every item has an attempt: its first attempt through counts, and a retry never undoes it. */
export function setDone(set: StudySet, answers: SetAnswers): boolean {
  return set.items.length > 0 && answeredItems(set, answers).length === set.items.length;
}

/** The header note for a set short of the count it was asked for, else ''. */
export function setShortfall(set: StudySet): string {
  const n = set.items.length;
  const asked = set.asked ?? 0;
  return asked > n ? `${n} of ${asked}: ${asked - n} didn’t pass E.V.’s checks` : '';
}

/**
 * Editing a set never changes it: the edit is a new own set written by the page with the edited items, and the
 * original and its answers stay as they were. The caller picks the new id and hides the original.
 */
export function editSet(original: StudySet, items: SetItem[], now: string): StudySet {
  return {
    ...original,
    writer: 'page',
    at: now,
    source: 'v5 edit',
    items,
    createdAt: now,
  };
}
