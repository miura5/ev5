import { expect, test } from 'vitest';
import { chapterNums, chapterOf, displayOrder, miniOrder, topicMatcher, type Item } from './index.ts';

const I = (x: object) => x as Item;

const ABG = ['Respiratory acidosis', 'Respiratory alkalosis', 'Metabolic acidosis', 'Metabolic alkalosis'];
const rome = (n: number) =>
  I({
    id: 'rome-' + n,
    kind: 'check',
    type: 'single',
    stem: `ABG ${n}: pH and values given. Which imbalance is it?`,
    options: [...ABG],
    correct: [n - 1],
    rationales: ABG.map((a) => a + '.'),
  });
const matrix = I({
  id: 'rome-mx',
  type: 'matrix',
  stem: 'Match each ABG to its imbalance.',
  matrix: { columns: [...ABG], rows: ABG.map((a, i) => ({ text: 'ABG row ' + (i + 1), correct: i, rationale: a })) },
});
const SET = { id: 'job-20261021-rome', items: [rome(1), rome(2), rome(3), rome(4), matrix] };
// the run rule, restated here so the test does not lean on the code's own
const runs = (seq: number[]) =>
  seq.slice(2).filter((x, i) => {
    const a = seq[i + 1]! - seq[i]!;
    const b = x - seq[i + 1]!;
    return a === b && Math.abs(a) <= 1;
  }).length;
const shownRight = (set: { items: Item[] }, order: ReturnType<typeof displayOrder>) =>
  set.items.filter((q) => q.type === 'single').map((q) => (order[q.id]!.options as number[]).indexOf(q.correct![0]!));

test('display order: each option and row shown once, stored items untouched, no run of three right places', () => {
  const before = JSON.stringify(SET);
  const order = displayOrder(SET, SET.items);
  for (const q of SET.items.filter((x) => x.type === 'single'))
    expect([...(order[q.id]!.options as number[])].sort()).toEqual([0, 1, 2, 3]);
  expect([...(order['rome-mx']!.rows as number[])].sort()).toEqual([0, 1, 2, 3]);
  expect(JSON.stringify(SET)).toBe(before);
  const seq = shownRight(SET, order);
  expect(runs(seq)).toBe(0);
  expect(seq).not.toEqual([0, 1, 2, 3]);
  const mx = (order['rome-mx']!.rows as number[]).map((i) => matrix.matrix!.rows[i]!.correct);
  expect(runs(mx)).toBe(0);
  for (let k = 0; k < 200; k++) {
    const s = { ...SET, id: 'set-' + k };
    expect(runs(shownRight(s, displayOrder(s, s.items)))).toBe(0);
  }
});

test('display order: the same on every reload, seeded by ids not place; numeric and open have none', () => {
  const a = displayOrder(SET, SET.items);
  expect(displayOrder(JSON.parse(JSON.stringify(SET)), JSON.parse(JSON.stringify(SET.items)))).toEqual(a);
  const lone = { id: SET.id, items: [rome(3)] };
  const moved = { id: SET.id, items: [matrix, rome(3)] };
  expect(displayOrder(lone, lone.items)['rome-3']).toEqual(displayOrder(moved, moved.items)['rome-3']);
  expect(displayOrder({ ...SET, id: 'job-20261022-rome' }, SET.items)).not.toEqual(a);
  const mixed = [
    I({ id: 'n1', type: 'numeric', stem: 'A dose', answer: 2, unit: 'mL', steps: ['x'] }),
    I({ id: 'o1', type: 'open', stem: 'Explain', keyPoints: [] }),
    I({ id: 's1', type: 'sata', stem: 'Select all', options: ['a', 'b', 'c', 'd', 'e'], correct: [0, 2] }),
  ];
  const o = displayOrder({ id: 'mixed' }, mixed);
  expect(o.n1).toBeUndefined();
  expect(o.o1).toBeUndefined();
  expect([...(o.s1!.options as number[])].sort()).toEqual([0, 1, 2, 3, 4]);
});

test('the mini quiz rotates through a three-question set and says how many are new', () => {
  const items = ['a', 'b', 'c'].map((id) => ({ id }));
  let r = miniOrder(items, {});
  expect(r.pick.map((q) => q.id)).toEqual(['a', 'b', 'c']);
  expect(r.fresh).toBe(3);
  r = miniOrder(items, { a: { at: '2026-10-30T10:00Z' } });
  expect(r.pick.map((q) => q.id)).toEqual(['b', 'c', 'a']);
  expect(r.fresh).toBe(2);
  r = miniOrder(items, {
    a: { at: '2026-10-30T12:00Z' },
    b: { at: '2026-10-30T10:00Z' },
    c: { at: '2026-10-30T11:00Z' },
  });
  expect(r.pick.map((q) => q.id)).toEqual(['b', 'c', 'a']);
  expect(r.fresh).toBe(0);
  expect(miniOrder(items, {}, { lead: (q) => q.id === 'c', n: 2 }).pick.map((q) => q.id)).toEqual(['c', 'a']);
});

test('a chapter is read from his words, a title or an objective', () => {
  for (const t of ['chapter 9', 'Chapter 9 mock exam', 'ch 9', 'Ch. 9', 'ch9', 'chap 9', 'BIO 201 Ch 9 Muscles.pdf'])
    expect(chapterOf(t), t).toBe(9);
  expect(chapterOf('muscle contraction')).toBeNull();
  expect(chapterOf('BIO 201')).toBeNull();
  expect(chapterOf('each 9 questions')).toBeNull();
  expect([...chapterNums([9, '10'])]).toEqual([9, 10]);
  expect([...chapterNums('Ch 9-11')]).toEqual([9, 10, 11]);
  expect([...chapterNums(['Chapter 9'])]).toEqual([9]);
  expect(chapterNums(undefined).size).toBe(0);
});

test('a question is on a chapter by its objective, source, words or set; a worded topic needs half its words', () => {
  const objectives = [
    { id: 'X1-1', chapters: [9] },
    { id: 'X1-2', chapters: ['8'] },
  ];
  const materials = [{ id: 'mat-ch9', title: 'Ch 9 Muscle tissue slides' }];
  const on = topicMatcher('chapter 9', { objectives, materials })!;
  expect(on(I({ objective: 'X1-1', stem: 'Which band shortens?' }))).toBe(true);
  expect(on(I({ objective: 'X1-2', stem: 'Which bone is this?' }))).toBe(false);
  expect(on(I({ sourceRef: 'materials/mat-ch9', stem: 'Which ion binds troponin?' }))).toBe(true);
  expect(on(I({ stem: 'Which ion binds troponin?' }), { title: 'Mock exam · X 101 · chapter 9' })).toBe(true);
  expect(on(I({ stem: 'Which ion binds troponin?' }), { title: 'More practice · Sun 1 Nov' })).toBe(false);
  expect(on(null)).toBe(false);
  const words = topicMatcher('muscle contraction')!;
  expect(words(I({ topic: 'Muscle contraction', stem: 'What starts the power stroke?' }))).toBe(true);
  expect(words(I({ topic: 'Muscles', stem: 'Which protein forms the thin filament?' }))).toBe(true);
  expect(words(I({ topic: 'Bone remodeling', stem: 'Which cell resorbs bone?' }))).toBe(false);
  expect(topicMatcher('')).toBeNull();
  expect(topicMatcher('mock exam')).toBeNull();
});
