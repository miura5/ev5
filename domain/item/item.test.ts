import { expect, test } from 'vitest';
import { itemType, numberAnswer, scoreAnswer, validateItem, type Item } from './index.ts';

const I = (x: object) => x as Item;

test('question checks: single, select-all, matrix and the bad cases', () => {
  const single = I({
    id: 'q1',
    type: 'single',
    objective: 'E4-3',
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
    stem: 'For each finding in an 80-year-old, mark expected or unexpected.',
    matrix: { columns: ['Expected', 'Unexpected'], rows },
  });
  expect(validateItem(matrix, { strict: true }).ok).toBe(true);
  expect(validateItem({ ...matrix, matrix: { columns: ['E', 'U'], rows: rows.slice(0, 2) } }).ok).toBe(false);
  const bad = { columns: ['E', 'U'], rows: [...rows.slice(0, 2), { text: 'x', correct: 3, rationale: 'r' }] };
  expect(validateItem({ ...matrix, matrix: bad }).ok).toBe(false);
  expect(validateItem(null).errors).toEqual(['not an object']);
});

test('number answers: a value, any unit as free text, a tolerance and steps; scored within tolerance', () => {
  const n = I({
    id: 'n1',
    type: 'numeric',
    stem: 'A car covers 150 km in 2.5 hours. What is its average speed?',
    answer: 60,
    unit: 'km/h',
    tolerance: 0.5,
    steps: ['150 / 2.5 = 60'],
  });
  expect(validateItem(n).errors).toEqual([]);
  expect(validateItem({ ...n, unit: 'furlongs per fortnight' }).ok).toBe(true);
  expect(validateItem({ ...n, unit: undefined }).ok).toBe(true);
  expect(validateItem({ ...n, unit: ' ' }).ok).toBe(false);
  expect(validateItem({ ...n, tolerance: -1 }).ok).toBe(false);
  expect(validateItem({ ...n, answer: undefined }).ok).toBe(false);
  expect(validateItem({ ...n, steps: [] }).ok).toBe(false);
  expect(validateItem({ ...n, options: ['a', 'b'] }).ok).toBe(false);
  expect(scoreAnswer(n, '60 km/h').correct).toBe(true);
  expect(scoreAnswer(n, '60 KM / H').correct).toBe(true);
  expect(scoreAnswer(n, 60.4).correct).toBe(true);
  expect(scoreAnswer(n, { value: 60, unit: 'Km/H' }).correct).toBe(true);
  expect(scoreAnswer(n, '60 mph').correct).toBe(false);
  expect(scoreAnswer(n, '61 km/h').correct).toBe(false);
  expect(scoreAnswer(n, 'about sixty').correct).toBe(false);
  expect(scoreAnswer(I({ ...n, unit: undefined, tolerance: undefined }), '60').correct).toBe(true);
  expect(numberAnswer('2.5 cm')).toEqual({ value: 2.5, unit: 'cm' });
  expect(numberAnswer('none')).toBeNull();
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

test('no subject is asked for: a plain question passes strict checks; an open answer is not scored here', () => {
  const plain = {
    id: 'q1',
    type: 'single',
    stem: 'Which gas do plants take in?',
    options: ['CO2', 'O2'],
    correct: [0],
    rationales: ['a', 'b'],
    objective: 'o',
  };
  expect(validateItem(plain, { strict: true })).toEqual({ ok: true, errors: [], warnings: [] });
  expect(() => scoreAnswer(open(), 'Fluid ends up in the lungs.')).toThrow(/not scored/);
});
