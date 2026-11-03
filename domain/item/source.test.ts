import { expect, test } from 'vitest';
import { ITEM_CONFIG, crossCourse, isDosageMaterial, isDosageTopic, type Item } from './index.ts';

const I = (x: object) => x as Item;
const EXAMS = [
  { id: 'E4', course: 'NUR 112' },
  { id: 'BX3', course: 'BIO 201' },
];
const OBJECTIVES = [
  { id: 'E4-8', exam: 'E4' },
  { id: 'BX3-2', exam: 'BX3' },
];
const MATERIALS = [
  { id: 'BIO201-501', course: 'BIO 201', title: 'Bones slides.pptx' },
  { id: 'NUR112-502', course: 'NUR 112', title: 'Nutrition.pptx' },
];
const item = (x: object = {}) =>
  I({
    id: 'p1',
    kind: 'check',
    type: 'single',
    objective: 'E4-8',
    stem: 'A client with a slow-healing wound lacks which vitamin needed for collagen? (from BIO 201: Bones slides)',
    options: ['Vitamin C', 'Vitamin A', 'Vitamin D', 'Vitamin K'],
    correct: [0],
    sourceRef: 'materials/BIO201-501',
    ...x,
  });
const ctx = { materials: MATERIALS, exams: EXAMS, objectives: OBJECTIVES };

test('an item on another course’s passage names its source and counts toward its own objective’s course', () => {
  const c = crossCourse(item(), ctx);
  expect(c.course).toBe('NUR 112');
  expect(c.source).toEqual({ course: 'BIO 201', title: 'Bones slides', label: 'from BIO 201: Bones slides' });
  expect(c.errors).toEqual([]);
  expect(c.item.stem).toBe(item().stem);
  const bare = crossCourse(item({ stem: 'A client’s wound heals slowly. Which vitamin builds its collagen?' }), ctx);
  expect(bare.item.stem).toBe(
    'A client’s wound heals slowly. Which vitamin builds its collagen? (from BIO 201: Bones slides)',
  );
  expect(crossCourse(item({ sourceRef: 'materials/NUR112-502' }), ctx).source).toBeNull();
  expect(crossCourse(item({ sourceRef: null, verify: true }), ctx).source).toBeNull();
  const bio = crossCourse(item({ objective: 'BX3-2' }), ctx);
  expect([bio.course, bio.source]).toEqual(['BIO 201', null]);
});

test('an item on another course’s passage that targets no objective of its own course is not kept', () => {
  const none = crossCourse(item({ objective: '' }), { ...ctx, set: { exam: 'E4' } });
  expect(none.errors[0]).toMatch(/rests on BIO 201 material \(Bones slides\) but targets no objective of its own course/);
  expect(crossCourse(item({ objective: 'E9-1' }), { ...ctx, set: { exam: 'E4' } }).errors).toHaveLength(1);
});

test('with no exam, the course a set was written for names its course', () => {
  const cfg = { ...ITEM_CONFIG, courses: ['NUR 112', 'BIO 201'] };
  const set = { exam: null, focus: 'nur112' };
  const c = crossCourse(item({ objective: '' }), { materials: MATERIALS, exams: [], objectives: [], set }, cfg);
  expect(c.course).toBe('NUR 112');
  expect(crossCourse(item({ objective: '' }), { materials: MATERIALS, exams: [], set }).course).toBeNull();
});

test('dosage material and dosage topics', () => {
  expect(isDosageMaterial({ title: 'Dosage calculation practice.pdf' })).toBe(true);
  expect(isDosageMaterial({ title: 'Syllabus: dosage exam dates' })).toBe(false);
  expect(isDosageMaterial({ title: 'Drug cards', module: 'Dosage' })).toBe(false);
  expect(isDosageMaterial({ title: 'Nutrition.pptx' })).toBe(false);
  expect(isDosageMaterial(null)).toBe(false);
  expect(isDosageTopic('more drip rates please')).toBe(true);
  expect(isDosageTopic('medication math')).toBe(true);
  expect(isDosageTopic('fluid balance')).toBe(false);
});

test('no course is named in the defaults: course facts are data', () => {
  expect(ITEM_CONFIG.courses).toEqual([]);
});
