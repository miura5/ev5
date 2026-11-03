import { expect, test } from 'vitest';
import {
  gradeOpenLocal,
  gradePrompt,
  itemType,
  parseGrade,
  scoreAnswer,
  validItems,
  validateItem,
  type Item,
} from './index.ts';

const I = (x: object) => x as Item;

test('question checks: single, select-all, matrix and the bad cases', () => {
  const single = I({
    id: 'q1',
    type: 'single',
    objective: 'E4-3',
    cjStep: 'analyze-cues',
    stem: 'Which finding needs follow-up first?',
    options: ['A', 'B', 'C', 'D'],
    correct: [2],
    rationales: ['a', 'b', 'c', 'd'],
  });
  expect(validateItem(single, { strict: true }).ok).toBe(true);
  expect(validateItem({ ...single, correct: [4] }).ok).toBe(false);
  expect(validateItem({ ...single, correct: [0, 1] }).ok).toBe(false);
  expect(validateItem({ ...single, stem: 'Select two findings that need follow-up.' }).ok).toBe(false);
  expect(validateItem({ ...single, rationales: ['a'] }, { strict: true }).ok).toBe(false);
  expect(validateItem({ ...single, rationales: ['a'] }).ok).toBe(true);
  expect(validateItem({ ...single, cjStep: 'guessing' }).ok).toBe(false);
  expect(validateItem({ ...single, options: ['A', 'a', 'C'], correct: [0], rationales: ['', '', ''] }).ok).toBe(false);
  const sata = {
    ...single,
    id: 'q2',
    type: 'sata' as const,
    options: ['A', 'B', 'C', 'D', 'E'],
    correct: [0, 3],
    rationales: ['a', 'b', 'c', 'd', 'e'],
  };
  expect(validateItem(sata, { strict: true }).ok).toBe(true);
  expect(validateItem({ ...sata, correct: [1] }).ok).toBe(false);
  const rows = [
    { text: 'Thinner skin', correct: 0, rationale: 'r' },
    { text: 'New confusion', correct: 1, rationale: 'r' },
    { text: 'Slower reaction time', correct: 0, rationale: 'r' },
  ];
  const matrix = I({
    id: 'q3',
    type: 'matrix',
    objective: 'E4-3',
    cjStep: 'recognize-cues',
    stem: 'For each finding in an 80-year-old, mark expected or unexpected.',
    matrix: { columns: ['Expected', 'Unexpected'], rows },
  });
  expect(validateItem(matrix, { strict: true }).ok).toBe(true);
  expect(validateItem({ ...matrix, matrix: { columns: ['E', 'U'], rows: rows.slice(0, 2) } }).ok).toBe(false);
  const bad = { columns: ['E', 'U'], rows: [...rows.slice(0, 2), { text: 'x', correct: 3, rationale: 'r' }] };
  expect(validateItem({ ...matrix, matrix: bad }).ok).toBe(false);
  expect(validateItem(null).errors).toEqual(['not an object']);
});

test('numeric items: a number with a configured unit, tolerance and steps; scored within tolerance', () => {
  const n = I({
    id: 'n1',
    type: 'numeric',
    stem: 'Give 250 mg from 125 mg per 5 mL. How many mL?',
    answer: 10,
    unit: 'mL',
    tolerance: 0.05,
    steps: ['250 / 125 x 5 = 10'],
    cjStep: 'take-action',
  });
  expect(validateItem(n).errors).toEqual([]);
  expect(validateItem({ ...n, unit: 'furlongs' }).ok).toBe(false);
  expect(validateItem({ ...n, steps: [] }).ok).toBe(false);
  expect(validateItem({ ...n, options: ['a', 'b'] }).ok).toBe(false);
  expect(scoreAnswer(n, '10 mL').correct).toBe(true);
  expect(scoreAnswer(n, 10.04).correct).toBe(true);
  expect(scoreAnswer(n, { value: 10, unit: 'ML' }).correct).toBe(true);
  expect(scoreAnswer(n, '10 mg').correct).toBe(false);
  expect(scoreAnswer(n, '12 mL').correct).toBe(false);
  expect(scoreAnswer(n, 'about ten').correct).toBe(false);
  expect(itemType(n)).toBe('numeric');
});

test('scoring: exact for single, +/- for select-all, per row for matrix', () => {
  const sata = I({ type: 'sata', options: ['A', 'B', 'C', 'D', 'E'], correct: [0, 2, 3] });
  expect(scoreAnswer(sata, [3, 0, 2])).toEqual({ correct: true, score: 1 });
  expect(scoreAnswer(sata, [0, 2]).correct).toBe(false);
  expect(Math.round(scoreAnswer(sata, [0, 2]).score * 100)).toBe(67);
  expect(scoreAnswer(sata, [0, 1]).score).toBe(0);
  const m = I({ type: 'matrix', matrix: { columns: ['E', 'U'], rows: [{ correct: 0 }, { correct: 1 }, { correct: 0 }] } });
  expect(scoreAnswer(m, [0, 1, 0])).toEqual({ correct: true, score: 1 });
  expect(scoreAnswer(m, [0, 0, 0]).correct).toBe(false);
  expect(itemType(I({ correct: [0, 1] }))).toBe('sata');
});

const open = (o: object = {}) =>
  I({
    id: 'o1',
    kind: 'check',
    type: 'open',
    stem: 'Why does a made-up client with fluid volume excess develop crackles?',
    keyPoints: [
      { text: 'Extra fluid raises pressure in the capillaries', keywords: [['pressure', 'hydrostatic']] },
      {
        text: 'Fluid shifts into the lungs',
        keywords: [
          ['lung', 'alveoli', 'pulmonary'],
          ['fluid', 'water'],
        ],
      },
    ],
    modelAnswer: 'Excess volume raises capillary hydrostatic pressure, so fluid moves into the alveoli.',
    sourceRef: 'note/n1#FVE: extra volume pushes fluid into the lungs',
    objective: 'E4-3',
    topic: 'Crackles in fluid volume excess',
    ...o,
  });

test('the open check function: a valid item passes; each break is refused; a room number passes', () => {
  expect(validateItem(open()).errors).toEqual([]);
  expect(itemType(open())).toBe('open');
  const one = validateItem(open({ keyPoints: [open().keyPoints?.[0]] }));
  expect(one.errors.join(' ')).toMatch(/needs 2 or 3 key points/);
  const bad: Record<string, object> = {
    'a long stem': { stem: 'Why '.repeat(26) + 'crackles?' },
    'two questions': { stem: 'Why crackles here? And why not there?' },
    'four key points': { keyPoints: [1, 2, 3, 4].map(() => open().keyPoints?.[0]) },
    'a long point': { keyPoints: [{ text: 'word '.repeat(13), keywords: [['word']] }, open().keyPoints?.[1]] },
    'no keyword groups': { keyPoints: [{ text: 'Pressure rises', keywords: [] }, open().keyPoints?.[1]] },
    'no model answer': { modelAnswer: '' },
    'no sourceRef': { sourceRef: '' },
    options: { options: ['a', 'b'], correct: [0] },
  };
  for (const [why, o] of Object.entries(bad)) expect(validateItem(open(o)).ok, why).toBe(false);
  const room = open({ modelAnswer: 'The client in room 412 has crackles from the extra fluid in the lungs.' });
  expect(validateItem(room).errors).toEqual([]);
});

test('open answers graded by a model reply: right, partial, wrong; partial counts as a miss; the reply is shape-checked', () => {
  const q = open();
  const by = (hits: boolean[]) => scoreAnswer(q, { text: 'made-up answer', hits, gradedBy: 'model' }) as any;
  expect([by([true, true]), by([true, false]), by([false, false])].map((r) => [r.grade, r.correct])).toEqual([
    ['right', true],
    ['partial', false],
    ['wrong', false],
  ]);
  expect(by([true, false]).score).toBe(0.5);
  expect(by([true, true]).gradedBy).toBe('model');
  expect(parseGrade({ hits: [true, false] }, q)).toEqual([true, false]);
  expect(parseGrade({ hits: [true] }, q)).toBeNull();
  expect(parseGrade({ hits: ['yes', 'no'] }, q)).toBeNull();
  expect(parseGrade('{"hits": [true, true]}', q)).toBeNull();
  expect(parseGrade(null, q)).toBeNull();
  const p = gradePrompt(q, 'Fluid builds up in the lungs.');
  expect(p).toMatch(/1\. Extra fluid raises pressure in the capillaries/);
  expect(p).toMatch(/His answer:\nFluid builds up in the lungs\./);
  expect(p).toMatch(/\{"hits": \[true \| false, true \| false\]\}/);
});

test('open answers graded locally: a point is hit when a word of every keyword group is in his answer', () => {
  const q = open();
  const local = (text: string) => scoreAnswer(q, text) as any;
  const right = local('The hydrostatic pressure goes up, so water leaks into the lungs.');
  expect([right.grade, right.hits, right.gradedBy]).toEqual(['right', [true, true], 'local']);
  const part = local('Fluid ends up in the lungs.');
  expect([part.grade, part.hits]).toEqual(['partial', [false, true]]);
  const none = local('I am not sure.');
  expect([none.grade, none.hits]).toEqual(['wrong', [false, false]]);
  expect(gradeOpenLocal(q, 'PRESSURES rise; Waters fill the Alveoli')).toEqual([true, true]);
  const phrase = open({ keyPoints: [{ text: 'Third spacing', keywords: [['third space']] }, open().keyPoints?.[1]] });
  expect(gradeOpenLocal(phrase, 'fluid moves to a third space in the lung')).toEqual([true, true]);
  expect(gradeOpenLocal(phrase, 'space for a third of the fluid in the lung')).toEqual([false, true]);
  const mal = scoreAnswer(q, { text: 'Fluid ends up in the lungs.', hits: [true], gradedBy: 'model' }) as any;
  expect([mal.grade, mal.gradedBy]).toEqual(['partial', 'local']);
  expect(mal.attempt).toMatchObject({ text: 'Fluid ends up in the lungs.', grade: 'partial', gradedBy: 'local' });
});

test('a stem that gives its answer away is never shown', () => {
  const q = (x: object = {}) =>
    I({
      id: 'q1',
      kind: 'check',
      type: 'single',
      cjStep: 'take-action',
      stem: 'Ordered: cephalexin 25 mg/kg/day divided every 6 hours for a 15 kg child. How many mg per dose?',
      options: ['93.8 mg', '375 mg', '62.5 mg', '150 mg'],
      correct: [0],
      rationales: ['375 mg a day over 4 doses.', 'That is the daily dose.', 'No.', 'No.'],
      ...x,
    });
  const set = [q({ id: 'm1' }), q({ id: 'm2', stem: q().stem + ' (Answer: 93.8 mg.)' })];
  expect(validItems(set).map((x) => x.id)).toEqual(['m1']);
  expect(validItems(set).filter((x) => itemType(x) === 'single')).toHaveLength(1);
  expect(validItems('nope')).toEqual([]);
});
