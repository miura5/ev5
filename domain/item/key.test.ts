import { expect, test } from 'vitest';
import { answerKeyProblem as P, calcAnswer, stemGivesAway, type Item } from './index.ts';

const I = (x: object) => x as Item;
const base = { type: 'single', topic: 'pediatric dosing', cjStep: 'take-action', verify: true };
// 20 kg, 15 mg/kg/day divided every 12 hours; the single dose is 150 mg
const q12 = (correct: number, rationales?: string[]) =>
  I({
    ...base,
    stem: 'A child weighs 20 kg. The order is 15 mg/kg/day divided every 12 hours. What is the single dose?',
    options: ['75 mg', '300 mg', '37.5 mg', '150 mg'],
    correct: [correct],
    rationales: rationales || [
      'Divides by 4, not 2.',
      'That is the whole day.',
      'Divides by 8.',
      'Correct: 20 × 15 = 300 mg/day, ÷ 2 = 150 mg.',
    ],
    calc: { weightKg: 20, dosePerKg: 15, per: 'day', everyHours: 12, doseUnit: 'mg' },
  });
// 14 kg, 25 mg/kg/day q8h, 100 mg per 5 mL: 116.7 mg a dose, 5.83 mL; no option offered it
const q8 = I({
  ...base,
  stem: 'A 14 kg child needs 25 mg/kg/day divided every 8 hours. The stock is 100 mg/5 mL. How many mL per dose?',
  options: ['0.7 mL', '2.5 mL', '1.5 mL', '4.2 mL'],
  correct: [1],
  rationales: ['No.', '350 mg/day ÷ 3 = 116.7 mg; 116.7 ÷ 100 × 5 = 5.8 mL.', 'No.', 'No.'],
  calc: { weightKg: 14, dosePerKg: 25, per: 'day', dosesPerDay: 3, stockAmount: 100, stockUnit: 'mg', stockMl: 5 },
});

test('the 20 kg item keyed 150 mg is kept; keyed 75 mg it is dropped', () => {
  expect(calcAnswer(q12(3).calc)).toEqual({ value: 150, unit: 'mg' });
  expect(P(q12(3))).toBeNull();
  expect(P(q12(0))).toMatch(/key is not the worked answer \(150 mg\)/);
});

test('the 14 kg item is dropped when no option is 5.83 mL; with 5.8 mL among the options it holds', () => {
  expect(Math.abs((calcAnswer(q8.calc)?.value ?? 0) - 5.8333)).toBeLessThan(0.001);
  expect(P(q8)).toMatch(/no option is the worked answer \(5\.83 mL\)/);
  expect(P({ ...q8, options: ['0.7 mL', '5.8 mL', '1.5 mL', '4.2 mL'] })).toBeNull();
});

test('a rationale that contradicts its key drops the item', () => {
  const said = [
    '300 mg / 2 = 150 mg, so 75 mg is wrong for this order.',
    'That is the whole day.',
    'Divides by 8.',
    'Close, but not the key.',
  ];
  const { calc: _calc, ...plain } = q12(0, said);
  expect(P(plain)).toBe('a rationale says the key is wrong');
  expect(P({ ...plain, rationales: ['Yes.', said[0]!, said[2]!, said[3]!] })).toBe('a rationale says the key is wrong');
  const concept = I({
    ...base,
    stem: 'Which finding fits fluid volume deficit in an adult client?',
    options: ['Tachycardia', 'Bradycardia', 'Weight gain', 'Crackles'],
    correct: [1],
    rationales: ['Wait, this is the right one.', 'Right.', 'No.', 'No.'],
  });
  expect(P(concept)).toBe('a rationale corrects itself');
  const names = {
    ...concept,
    rationales: ['Yes.', 'The correct answer is tachycardia, since the heart speeds up.', 'No.', 'No.'],
  };
  expect(P(names)).toBe('a rationale names another option as the answer');
  expect(P({ ...concept, correct: [0], rationales: ['Right.', 'No.', 'No.', 'No.'] })).toBeNull();
});

test('a calculation with no calc is not trusted; rates, drops and conversions are worked', () => {
  const { calc: _calc, ...bare } = q12(3);
  expect(P(bare)).toBe('a calculation with no calc to check its key');
  expect(calcAnswer({ volumeMl: 1000, hours: 8 })).toEqual({ value: 125, unit: 'ml/hr' });
  expect(Math.round((calcAnswer({ volumeMl: 1000, hours: 8, dropFactor: 10 })?.value ?? 0) * 10) / 10).toBe(20.8);
  expect(calcAnswer({ value: 44, from: 'lb', to: 'kg' })?.value).toBe(20);
  expect(calcAnswer({ value: 0.25, from: 'mg', to: 'mcg' })?.value).toBe(250);
  expect(calcAnswer({ dose: 500, doseUnit: 'mg', stockAmount: 250, stockUnit: 'mg', stockForm: 'tablet' })).toEqual({
    value: 2,
    unit: 'tablets',
  });
  expect(calcAnswer({ weightKg: 10 })).toBeNull();
  const drip = I({
    ...base,
    stem: 'Infuse 1,000 mL over 8 hours with a drop factor of 10 gtt/mL. How many gtt/min?',
    options: ['21 gtt/min', '125 gtt/min', '13 gtt/min', '42 gtt/min'],
    correct: [0],
    rationales: ['1000 × 10 ÷ 480 = 20.8, so 21.', 'mL/hr.', 'No.', 'No.'],
    calc: { volumeMl: 1000, hours: 8, dropFactor: 10 },
  });
  expect(P(drip)).toBeNull();
  const numeric = I({
    ...base,
    type: 'numeric',
    stem: 'Give 250 mg from a stock of 125 mg per 5 mL. How many mL? Round to tenths.',
    answer: 10,
    unit: 'mL',
    tolerance: 0.05,
    steps: ['250 ÷ 125 × 5 = 10 mL'],
    calc: { dose: 250, doseUnit: 'mg', stockAmount: 125, stockUnit: 'mg', stockMl: 5 },
  });
  expect(P(numeric)).toBeNull();
  expect(P({ ...numeric, answer: 7 })).toMatch(/not the worked 10/);
  const words = I({
    ...base,
    stem: 'The order reads 15 mg/kg/day. What should the nurse check before giving it?',
    options: ['The client’s weight', 'The client’s height', 'The room number', 'The diet order'],
    correct: [0],
    rationales: ['Right.', 'No.', 'No.', 'No.'],
  });
  expect(P(words)).toBeNull();
});

test('a stem that gives its answer away, or asks nothing, is dropped; a clean stem is kept', () => {
  const item = (stem: string, options: string[], correct: number, calc: object) =>
    I({ ...base, stem, options, correct: [correct], rationales: options.map(() => 'Worked in the rationale.'), calc });
  const genta = item(
    'A 15 kg child is ordered gentamicin 2.5 mg/kg IV every 8 hours. What is the single dose in mg? (Answer: 37.5 mg.)',
    ['37.5 mg', '112.5 mg', '12.5 mg', '75 mg'],
    0,
    { weightKg: 15, dosePerKg: 2.5, per: 'dose' },
  );
  const each = item(
    'A 22 kg child is ordered 40 mg/kg/day divided every 8 hours. What is the dose for each administration? (Dose per day = 880 mg; each dose = 293.3 mg.)',
    ['293.3 mg', '880 mg', '440 mg', '110 mg'],
    0,
    { weightKg: 22, dosePerKg: 40, per: 'day', everyHours: 8 },
  );
  const told = item(
    'A 14 kg child is ordered 1.2 mg/kg per dose of a medication. Each dose is 16.8 mg. (Check your materials: pediatric dosing.)',
    ['16.8 mg', '8.4 mg', '33.6 mg', '1.2 mg'],
    0,
    { weightKg: 14, dosePerKg: 1.2, per: 'dose' },
  );
  expect(P(genta)).toBe('its stem gives its answer away');
  expect(P(each)).toBe('its stem gives its answer away');
  expect(P(told)).toBe('its stem asks no question');
  const clean = item(
    'A 15 kg child is ordered gentamicin 2.5 mg/kg IV every 8 hours. What is the single dose in mg?',
    ['37.5 mg', '112.5 mg', '12.5 mg', '75 mg'],
    0,
    { weightKg: 15, dosePerKg: 2.5, per: 'dose' },
  );
  expect(P(clean)).toBeNull();
  expect(P({ ...clean, stem: clean.stem.replace('What', 'The dose is 37.5 mg. What') })).toBe(
    'its stem gives its answer away',
  );
});

test('ordinary rationale wording is kept; only a real self-correction or a key calling itself wrong drops', () => {
  const q = (rationales: string[]) =>
    I({
      ...base,
      stem: 'A client received IV morphine for pain. What should the nurse do next?',
      options: ['Reassess pain', 'Give a second dose', 'Ambulate the client', 'Discharge the client'],
      correct: [0],
      rationales,
    });
  const kept = [
    'Wait 30 minutes after IV morphine, then reassess pain.',
    'A client this drowsy may actually be oversedated.',
    'With a new weight the nurse would need to recalculate the dose.',
    'Reassessing is the priority; the other options are incorrect because they skip the check.',
  ];
  for (const r of kept) expect(P(q([r, 'No.', 'No.', 'No.'])), r).toBeNull();
  expect(P(q(['Wait, the dose is wrong here.', 'No.', 'No.', 'No.']))).toBe('a rationale corrects itself');
  expect(P(q(['Hmm, let me recheck that.', 'No.', 'No.', 'No.']))).toBe('a rationale corrects itself');
  expect(P(q(['This answer is incorrect: reassess first.', 'No.', 'No.', 'No.']))).toBe(
    'the key’s own rationale calls it wrong',
  );
});

test('stemGivesAway catches an answer said, a worked solution or a repeated key; fair stems pass', () => {
  const q = (x: object) =>
    I({
      id: 'q1',
      type: 'single',
      stem: 'Ordered: cephalexin 25 mg/kg/day divided every 6 hours for a 15 kg child. How many mg per dose?',
      options: ['93.8 mg', '375 mg', '62.5 mg', '150 mg'],
      correct: [0],
      ...x,
    });
  const leaks = [
    q({ stem: 'Which dose is right? The correct answer is 93.8 mg.' }),
    q({ stem: 'Which dose is right for a 15 kg child? Solution: 25 x 15 = 375; 375 / 4.' }),
    q({
      stem: 'Which vitamin is needed to build collagen? (Vitamin C)',
      options: ['Vitamin C', 'Vitamin A', 'Vitamin D', 'Vitamin K'],
    }),
  ];
  for (const x of leaks) expect(stemGivesAway(x), x.stem).toBe('its stem gives its answer away');
  const fair = [
    q({}),
    q({
      stem: 'A client’s potassium = 5.8 mEq/L. Which finding needs action first?',
      options: ['Peaked T waves', 'Thirst', 'Dry skin', 'Fatigue'],
    }),
    q({
      stem: 'Which vitamin is needed to build collagen? Choose one.',
      options: ['Vitamin C', 'One', 'Vitamin D', 'Vitamin K'],
    }),
    I({ id: 'o1', type: 'open', stem: 'Answer: in two lines, why does vitamin C matter for healing?' }),
  ];
  for (const x of fair) expect(stemGivesAway(x), x.stem).toBeNull();
});
