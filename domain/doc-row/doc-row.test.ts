import { expect, test } from 'vitest';
import { parseExamRow } from '../exam/row.ts';
import { parseObjectiveRow } from '../objective/row.ts';
import { parseWeakSpotRow } from '../weak-spot/row.ts';
import { parseSetRow } from '../set/row.ts';
import { parseSessionRow } from '../session/row.ts';
import { parseNoteRow } from '../note/row.ts';
import { parseCourseRow } from '../course/row.ts';

const T = '2026-11-03T15:00:00.000Z';
const N = 1_762_300_800_000;
const row = (c: string, data: unknown, extra: Record<string, unknown> = {}) => ({ c, id: 'x1', data, at: N, v: 1, ...extra });

const exam = { schema: 2, writer: 'page', at: T, source: 't', title: 'Unit 1', kind: 'unit', date: '2026-11-10' };
const objective = { schema: 1, writer: 'page', at: T, source: 't', exam: 'e1', text: 'Explain fluid shifts' };
const weakSpot = {
  schema: 2,
  writer: 'page',
  at: T,
  source: 't',
  topic: 'a',
  objective: 'E4-3',
  kind: 'concept',
  initial: { streak: 0 },
  events: {},
};
const set = {
  schema: 3,
  writer: 'worker',
  at: T,
  source: 't',
  kind: 'drill',
  items: [{ id: 'q1', stem: 'Which finding needs action first?', options: ['a', 'b', 'c'], correct: [1] }],
};
const session = { schema: 2, writer: 'page', at: T, source: 'E.V. Home', date: '2026-11-03' };
const note = { schema: 1, writer: 'page', at: T, source: 't', createdAt: T, title: 'Fluids', blocks: [] };

const kinds = [
  { c: 'exams', parse: parseExamRow, data: exam, bad: { ...exam, kind: 'quiz' } },
  { c: 'objectives', parse: parseObjectiveRow, data: objective, bad: { ...objective, text: '' } },
  { c: 'weakspots', parse: parseWeakSpotRow, data: weakSpot, bad: { ...weakSpot, kind: 'other' } },
  { c: 'sets', parse: parseSetRow, data: set, bad: { ...set, items: [] } },
  { c: 'sessions', parse: parseSessionRow, data: session, bad: { ...session, date: 'today' } },
  { c: 'notes', parse: parseNoteRow, data: note, bad: { ...note, schema: 2 } },
];

test.each(kinds)('a $c row parses its document, and refuses a wrong shape', ({ c, parse, data, bad }) => {
  expect(parse(row(c, data)).data).toEqual(data);
  expect(() => parse(row(c, bad))).toThrow(); // a bad document
  expect(() => parse(row('other', data))).toThrow(); // the wrong collection
  expect(() => parse(row(c, data, { id: '' }))).toThrow();
  expect(() => parse(row(c, data, { v: 0 }))).toThrow();
  expect(() => parse(row(c, data, { at: -1 }))).toThrow();
  expect(() => parse(row(c, data, { extra: 1 }))).toThrow();
});

const course = {
  name: 'CARE 100',
  canvasId: 1001,
  status: 'active',
  examKinds: ['unit', 'final'],
  reviewKinds: ['unit'],
  examDayKinds: ['unit', 'final'],
  scoredKinds: [],
  calendarDayKinds: ['exam'],
  dayBudget: 'shared',
  aliases: '^care\\s*100$',
  default: true,
  library: [{ module: '^unit \\d+', kind: 'slides' }],
};

test('a course row parses, and each rule the table parser holds is refused', () => {
  expect(parseCourseRow(course).name).toBe('CARE 100');
  expect(parseCourseRow({ ...course, note: 'extra keys are kept' })).toHaveProperty('note');
  expect(() => parseCourseRow({ ...course, status: 'paused' })).toThrow(/status/);
  expect(() => parseCourseRow({ ...course, canvasId: 1.5 })).toThrow(/canvasId/);
  expect(() => parseCourseRow({ ...course, examKinds: [] })).toThrow(/examKinds/);
  expect(() => parseCourseRow({ ...course, reviewKinds: ['quiz'] })).toThrow(/reviewKinds is not a list of its examKinds/);
  expect(() => parseCourseRow({ ...course, dayBudget: 'own' })).toThrow(/dayBudget/);
  expect(() => parseCourseRow({ ...course, aliases: '(' })).toThrow(/not a pattern/);
  expect(() => parseCourseRow({ ...course, library: [{ module: '(', kind: 'slides' }] })).toThrow(/not a pattern/);
  expect(() => parseCourseRow({ ...course, library: [{ kind: 'slides' }] })).toThrow(/library/);
});
