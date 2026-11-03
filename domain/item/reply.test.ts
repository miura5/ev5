import { expect, test } from 'vitest';
import {
  ITEM_KEYS,
  normalizeItem as N,
  replyItems,
  salvageItems,
  setShortfall,
  tagItems,
  validateItem,
  scoreAnswer,
} from './index.ts';

const opts = ['Urine output 25 mL/h', 'Urine output 60 mL/h', 'Clear lung sounds', 'Heart rate 72'];
const why = opts.map((o) => 'Why: ' + o);
const stem = (n: number) => `A client on day ${n} after surgery is assessed. Which finding needs the nurse's action first?`;
const ok = (q: unknown, id = 'x') => validateItem({ ...(q as object), id }).ok;
// every question drifted once
const DRIFTED = {
  items: [
    { type: 'single', topic: 'a', stem: stem(1), options: opts, correct: 0, rationales: why, cjStep: 'analyze-cues' },
    { type: 'single', topic: 'b', stem: stem(2), options: opts, correct: ['B'], rationales: why, cjStep: 'take-action' },
    {
      type: 'Multiple Choice',
      topic: 'c',
      stem: stem(3),
      options: opts.map((text) => ({ text })),
      correct: [opts[2]],
      rationales: why,
      cjStep: 'Recognize Cues',
    },
    {
      type: 'select-all',
      topic: 'd',
      stem: stem(4),
      options: [...opts, 'Pain 2 of 10'],
      correct: ['0', '2'],
      rationales: [...why, 'Why: pain'],
      cjStep: 'prioritize_hypotheses',
    },
    {
      type: 'matrix',
      topic: 'e',
      stem: stem(5),
      matrix: {
        columns: ['Expected', 'Unexpected'],
        rows: [
          { text: 'Urine 20 mL/h', correct: 'Unexpected', rationale: 'low' },
          { text: 'Temp 37.0 C', correct: [0], rationale: 'normal' },
          { text: 'HR 130', correct: '1', rationale: 'fast' },
        ],
      },
      cjStep: 'a step it made up',
    },
  ],
};

test('every drifted question is refused as written, and mended so all five are usable and read as written', () => {
  expect(replyItems(DRIFTED).filter((q, i) => ok(q, 'm' + i))).toHaveLength(0);
  const qs = replyItems(DRIFTED).map((r) => N(r));
  qs.forEach((q, i) => expect(validateItem({ ...q, id: 'm' + i }).errors, 'item ' + i).toEqual([]));
  expect(qs[0].correct).toEqual([0]);
  expect(qs[1].correct).toEqual([1]);
  expect(qs[2].type).toBe('single');
  expect(qs[2].options).toEqual(opts);
  expect(qs[2].correct).toEqual([2]);
  expect(qs[2].cjStep).toBe('recognize-cues');
  expect(qs[3].type).toBe('sata');
  expect(qs[3].correct).toEqual([0, 2]);
  expect(qs[3].cjStep).toBe('prioritize-hypotheses');
  expect(qs[4].matrix.rows.map((r: { correct: number }) => r.correct)).toEqual([1, 0, 1]);
  expect('cjStep' in qs[4]).toBe(false);
  expect(DRIFTED.items[0]!.correct).toBe(0);
});

test('what cannot be read one way is still refused', () => {
  const bad = [
    { type: 'single', stem: stem(1), options: opts, correct: ['Z'], rationales: why, cjStep: 'take-action' },
    { type: 'single', stem: stem(2), options: opts, correct: ['none of these'], rationales: why },
    { type: 'single', stem: stem(3), options: opts, correct: 7, rationales: why },
    { type: 'quiz', stem: stem(4), options: opts, correct: [0] },
  ];
  for (const q of bad) expect(ok(N(q)), JSON.stringify(q)).toBe(false);
});

test('replyItems reads {items}, a bare array, {questions} and {set: {items}}; anything else is none', () => {
  const q = [{ stem: 'x' }];
  expect(replyItems({ items: q })).toEqual(q);
  expect(replyItems(q)).toEqual(q);
  expect(replyItems({ questions: q })).toEqual(q);
  expect(replyItems({ set: { items: q } })).toEqual(q);
  for (const r of [null, undefined, 'text', {}, { items: 'no' }]) expect(replyItems(r)).toEqual([]);
});

test('a reply cut short at max_tokens keeps its whole questions', () => {
  const whole = JSON.stringify(DRIFTED);
  const cut = whole.slice(0, whole.indexOf('"topic":"d"') + 40);
  expect(() => JSON.parse(cut)).toThrow();
  const got = salvageItems(cut) as { options: unknown }[];
  expect(got).toHaveLength(3);
  expect(got[2]!.options).toEqual(opts.map((text) => ({ text })));
  const tricky = '{"items":[{"stem":"Which } is ] right? \\"quoted\\" {","correct":[1]},{"stem":"cut';
  expect(salvageItems(tricky)).toEqual([{ stem: 'Which } is ] right? "quoted" {', correct: [1] }]);
  expect(salvageItems('Here you go:\n```json\n' + whole + '\n```')).toHaveLength(5);
  expect(salvageItems('no JSON at all')).toEqual([]);
});

test('a value that reads as an option and as a place naming another option is refused', () => {
  const ask = (options: unknown[], correct: unknown) =>
    ok(N({ type: 'single', stem: stem(1), options, correct, cjStep: 'take-action' }));
  expect(ask(['O', 'A', 'B', 'AB'], ['A'])).toBe(false);
  expect(ask(['3', '8', '12', '15'], ['3'])).toBe(false);
  expect(ask([2, 1, 4, 3], 1)).toBe(false);
  expect(N({ options: ['O', 'A', 'B', 'AB'], correct: ['AB'] }).correct).toEqual([3]);
  expect(N({ options: ['3', '8', '12', '15'], correct: '15' }).correct).toEqual([3]);
  expect(N({ options: ['O', 'B', 'C', 'AB'], correct: ['B'] }).correct).toEqual([1]);
  expect(N({ options: ['3', '8', '12', '15'], correct: 3 }).correct).toEqual([3]);
});

test('a mended set holds only the schema fields', () => {
  const sets = ITEM_KEYS.filter((k) => k !== 'id');
  expect(ITEM_KEYS).toHaveLength(21);
  expect(sets).not.toContain('calc');
  const extra = { ...DRIFTED.items[0], stem: undefined, question: stem(1), difficulty: 'easy', calc: { dose: 1 } };
  const q = N(extra);
  expect(Object.keys(q).every((k) => ITEM_KEYS.includes(k))).toBe(true);
  expect(q.stem).toBe(stem(1));
  const m = DRIFTED.items[4]!.matrix;
  const mx = N({ ...DRIFTED.items[4], matrix: { ...m!, note: 'n', rows: m!.rows.map((r) => ({ ...r, why: 'w' })) } });
  expect(Object.keys(mx.matrix)).toEqual(['columns', 'rows']);
  expect(Object.keys(mx.matrix.rows[0]).sort()).toEqual(['correct', 'rationale', 'text']);
});

test('columns that differ only by a symbol match on exact or folded text, symbols kept, else are refused', () => {
  const grid = (columns: string[], keys: string[]) =>
    N({
      type: 'matrix',
      stem: 'Which change does each finding show in this client?',
      matrix: { columns, rows: keys.map((k, i) => ({ text: 'Finding ' + (i + 1), correct: k, rationale: 'why' })) },
      cjStep: 'analyze-cues',
    });
  const keyed = (q: { matrix: { rows: { correct: unknown }[] } }) => q.matrix.rows.map((r) => r.correct);
  expect(keyed(grid(['↑', '↓', 'No change'], ['↓', '↓', '↓']))).toEqual([1, 1, 1]);
  expect(keyed(grid(['↑', '↓', 'No change'], ['↑', ' ↓ ', 'No change']))).toEqual([0, 1, 2]);
  expect(keyed(grid(['> 5', '< 5'], ['< 5', '> 5', '< 5']))).toEqual([1, 0, 1]);
  expect(keyed(grid(['Rh+', 'Rh-'], ['Rh-', 'Rh+', 'Rh-']))).toEqual([1, 0, 1]);
  expect(keyed(grid(['> 5', '< 5'], ['>5', '<  5', '< 5']))).toEqual([0, 1, 1]);
  expect(keyed(grid(['Rh+', 'Rh-'], ['rh-', 'RH+', 'Rh-.']))).toEqual([1, 0, 1]);
  expect(keyed(grid(['↑', '↓', 'No change'], [' ↓ ', 'no  change', 'No change.']))).toEqual([1, 2, 2]);
  expect(N({ options: ['Hypokalemia', 'Hyperkalemia'], correct: ['hyperkalemia.'] }).correct).toEqual([1]);
  expect(N({ options: ['Hyperkalemia.', 'Hypokalemia'], correct: ['hyperkalemia'] }).correct).toEqual([0]);
  expect(N({ options: ['> 5', '< 5', '= 5'], correct: ['< 5'] }).correct).toEqual([1]);
  for (const [cols, keys] of [
    [['↑', '↓', 'No change'], ['up', '↓', '↓']],
    [['No change', 'no change.', '↑'], ['NO CHANGE', '↑', '↑']],
  ] as [string[], string[]][]) {
    const q = grid(cols, keys);
    expect(ok(q), JSON.stringify(keys)).toBe(false);
    expect(keyed(q)[0]).toBe(keys[0]);
  }
  const single = (options: string[], correct: string[]) =>
    N({ type: 'single', stem: stem(1), options, correct, rationales: options.map(() => 'why'), cjStep: 'take-action' });
  for (const [options, correct] of [
    [['↑ potassium', 'No change'], ['↓ potassium']],
    [['Rh-', 'Unknown'], ['Rh+']],
    [['< 0.5 mL/kg/h', 'Normal'], ['> 0.5 mL/kg/h']],
  ] as [string[], string[]][]) {
    const q = single(options, correct);
    expect(q.correct).toEqual(correct);
    expect(ok(q)).toBe(false);
    expect(ok(grid(options, [correct[0]!, options[1]!, options[1]!]))).toBe(false);
  }
});

test('a numeric answer or tolerance written as a string becomes the number it says', () => {
  const dose = {
    type: 'numeric',
    topic: 'dosage',
    stem: 'Give 250 mg from a supply of 125 mg per 5 mL. Round to the tenth. How many mL?',
    unit: 'mL',
    steps: ['250 / 125 x 5 = 10'],
    cjStep: 'take-action',
  };
  const q = N({ ...dose, answer: ' 10 ', tolerance: '0.05' });
  expect([q.answer, q.tolerance]).toEqual([10, 0.05]);
  expect(ok(q)).toBe(true);
  expect(scoreAnswer(q, '10 mL').correct).toBe(true);
  const bad = N({ ...dose, answer: 'about 10', tolerance: 'half' });
  expect(bad.answer).toBe('about 10');
  expect(ok(bad)).toBe(false);
  expect(N({ type: 'open', answer: '10' }).answer).toBe('10');
});

test('tagItems: ids, spots, objectives and kinds; a bad sourceRef is left off; a dosage set holds checks only', () => {
  const T = (items: object[], spots: { id: string; objective?: string }[], ids: string[]) =>
    tagItems({ items }, { ids, spots });
  const q = { type: 'single', stem: 'Which finding needs action first?', options: ['a', 'b'], correct: [0] };
  const spots = [
    { id: 'ws-1', objective: '' },
    { id: 'ws-2', objective: 'E4-2' },
  ];
  const [a, b, c, d] = T(
    [
      { ...q, weakspotId: 'ws-1', objective: 'E9-9' },
      { ...q, weakspotId: 'ws-2', objective: 'E9-9' },
      { ...q, weakspotId: 'ws-gone', objective: 'E4-1' },
      { ...q, objective: 'E9-9' },
    ],
    spots,
    ['E4-1', 'E4-2'],
  );
  expect('objective' in a).toBe(false);
  expect([a.weakspotId, a.kind]).toEqual(['ws-1', 'review']);
  expect([b.objective, b.kind]).toEqual(['E4-2', 'review']);
  expect([c.objective, 'weakspotId' in c, c.kind]).toEqual(['E4-1', false, 'check']);
  expect('objective' in d).toBe(false);
  expect(T([{ ...q, weakspotId: 'ws-1', objective: 'E9-9' }], spots, ['E4-1'])[0].objective).toBe('E4-1');
  expect(T([q, q], [], []).map((x) => x.id)).toEqual(['m1', 'm2']);
  const refs = tagItems({
    items: ['BIO 201 slides, chapter 3', 'materials/bio-ch3', 'note/n1#line'].map((sourceRef) => ({ ...q, sourceRef })),
  });
  expect('sourceRef' in refs[0]).toBe(false);
  expect([refs[1].sourceRef, refs[2].sourceRef]).toEqual(['materials/bio-ch3', 'note/n1#line']);
  const dose = {
    type: 'numeric',
    stem: 'Give 250 mg from a supply of 125 mg per 5 mL. Round to the tenth. How many mL?',
    answer: '10',
    unit: 'mL',
    tolerance: 0.05,
    steps: ['250 / 125 x 5 = 10'],
    calc: { dose: 250, doseUnit: 'mg', stockAmount: 125, stockUnit: 'mg', stockMl: 5 },
    cjStep: 'take-action',
    weakspotId: 'ws-anything',
  };
  const [item] = tagItems({ items: [dose] }, { ids: ['D1-1'], checks: true, type: 'numeric' });
  expect([item.kind, 'weakspotId' in item, item.objective]).toEqual(['check', false, 'D1-1']);
  expect(ok(item)).toBe(true);
  // a key its own numbers do not support is dropped
  expect(tagItems({ items: [{ ...dose, answer: 7 }] }, { checks: true })).toEqual([null]);
});

test('setShortfall names a set short of the count it was asked for', () => {
  expect(setShortfall({ asked: 4, items: [] }, 2)).toBe('2 of 4: 2 didn’t pass E.V.’s checks');
  expect(setShortfall({ asked: 4, items: [{ id: 'a', stem: 'x' }] })).toBe('1 of 4: 3 didn’t pass E.V.’s checks');
  expect(setShortfall({ items: [] })).toBe('');
  expect(setShortfall(null)).toBe('');
});
