import { expect, test } from 'vitest';
import {
  parseCourseTable,
  defaultCourse,
  activeCourses,
  normCourse,
  courseOf,
  guessCourse,
  nameCourse,
  examIs,
  spotCourse,
  namedCourse,
  nextExamCourse,
  noteCourse,
  noteParts,
  taskCourse,
  taskStart,
  examFrame,
  frameText,
  chatCourse,
  teachLine,
} from './index.ts';

// Ported from ev4 test/course-scope.test.mjs and test/courses.test.mjs. The courses are made up and live only in this
// fixture, as they live only in the spec in ev4 (§data.course-facts).
const rule = {
  status: 'active',
  endsAfter: 'final',
  dayBudget: 'shared',
  scoredKinds: [],
  calendarDayKinds: ['exam'],
  library: [{ module: '^unit \\d+', kind: 'slides' }],
};
const RAW = {
  _rules: ['notes start with an underscore'],
  'CARE 100': {
    ...rule,
    canvasId: 1001,
    examKinds: ['unit', 'dosage', 'final'],
    reviewKinds: ['unit', 'final'],
    examDayKinds: ['unit', 'dosage', 'final'],
    scoredKinds: ['unit'],
    aliases: '^care\\s*100$',
    default: true,
    nursing: true,
  },
  'LAND 200': {
    ...rule,
    canvasId: 2002,
    examKinds: ['unit', 'lab', 'final'],
    reviewKinds: ['unit', 'lab', 'final'],
    examDayKinds: ['unit', 'lab', 'final'],
    aliases: '^land\\s*200$',
    guess: '\\b(land\\s*200|soil|erosion|dune\\w*)\\b',
    nursing: false,
    exams: "LAND 200's lecture and field exams",
  },
};
const T = parseCourseTable(RAW);
const exams = [
  { id: 'E5', course: 'CARE 100', date: '2026-11-17', status: 'upcoming' },
  { id: 'L3', course: 'LAND 200', date: '2026-11-02' },
];
const objectives = [
  { id: 'E5-1', exam: 'E5' },
  { id: 'L3-2', exam: 'L3' },
];

test('the table reads, skips notes, and refuses a broken one', () => {
  expect(T.map((c) => c.name)).toEqual(['CARE 100', 'LAND 200']);
  expect(defaultCourse(T)).toBe('CARE 100');
  expect(defaultCourse([])).toBe(null);
  const broken = structuredClone(RAW) as unknown as Record<string, Record<string, unknown>>;
  delete broken['CARE 100']!.default;
  (broken['LAND 200']!.reviewKinds as string[]).push('quiz');
  expect(() => parseCourseTable(broken)).toThrow(/exactly one default/);
  expect(() => parseCourseTable(broken)).toThrow(/LAND 200: reviewKinds/);
  expect(() =>
    parseCourseTable({
      'X 1': {
        ...rule,
        canvasId: 1,
        examKinds: ['unit'],
        reviewKinds: [],
        examDayKinds: [],
        aliases: '(',
        default: true,
      },
    }),
  ).toThrow(/aliases is not a pattern/);
  expect(() => parseCourseTable(null)).toThrow();
});

test('names as the record writes them, guesses and defaults come from the table', () => {
  expect(normCourse(T, 'care100')).toBe('CARE 100');
  expect(normCourse(T, 'Land 200')).toBe('LAND 200');
  expect(normCourse(T, 'OTHER 1')).toBe('OTHER 1');
  expect(normCourse(T, '')).toBe(null);
  expect(courseOf(T, {})).toBe('CARE 100');
  expect(courseOf(T, { course: 'land200' })).toBe('LAND 200');
  expect(guessCourse(T, 'soil erosion and dunes')).toBe('LAND 200');
  expect(guessCourse(T, 'ch 39 anything else')).toBe('CARE 100');
  expect(nameCourse(T, 'ch 39 anything else')).toBe(null);
  const more = parseCourseTable({
    ...RAW,
    'ZED 300': { ...RAW['LAND 200'], canvasId: 3, guess: 'titration' },
  });
  expect(guessCourse(more, 'acid base titration')).toBe('ZED 300');
});

test('a done course leaves the active list; exam kinds come per course', () => {
  expect(activeCourses(T)).toEqual(['CARE 100', 'LAND 200']);
  const done = parseCourseTable({
    ...RAW,
    'LAND 200': { ...RAW['LAND 200'], status: 'done' },
  });
  expect(activeCourses(done)).toEqual(['CARE 100']);
  expect(examIs(T, { kind: 'lab', course: 'LAND 200' }, 'examDayKinds')).toBe(true);
  expect(examIs(T, { kind: 'lab' }, 'examDayKinds')).toBe(false);
  expect(examIs(T, { kind: 'unit', course: 'care100' }, 'scoredKinds')).toBe(true);
  expect(examIs(T, { course: 'care100' }, 'scoredKinds')).toBe(false);
});

test('a weak spot counts toward its objective’s course, whatever course it was filed under', () => {
  const misfiled = { objective: 'L3-2', exam: 'L3', course: 'CARE 100' };
  expect(spotCourse(T, misfiled, { exams, objectives })).toBe('LAND 200');
  expect(spotCourse(T, { objective: '', exam: '', course: 'LAND 200' }, { exams })).toBe('LAND 200');
  expect(spotCourse(T, { objective: '', exam: '' }, { exams })).toBe('CARE 100');
  expect(spotCourse(T, { objective: 'E5-9' }, { exams })).toBe('CARE 100'); // prefix E5 is CARE's
  expect(spotCourse(T, null)).toBe('CARE 100');
});

test('a line’s course: its name in any spacing, then guess words', () => {
  expect(namedCourse(T, 'quiz for care-100 tomorrow')).toBe('CARE 100');
  expect(namedCourse(T, 'dunes today', { guess: false })).toBe(null);
  expect(namedCourse(T, 'dunes today')).toBe('LAND 200');
  expect(namedCourse(T, 'nothing')).toBe(null);
});

test('a chat note’s course: own words, then the conversation, then the next exam', () => {
  expect(noteCourse(T, { text: 'land200 field trip' })).toBe('LAND 200');
  expect(noteCourse(T, { text: 'dunes', recent: ['talking care 100'] })).toBe('CARE 100');
  expect(noteCourse(T, { text: 'ok', recent: ['more on erosion'] })).toBe('LAND 200');
  expect(noteCourse(T, { text: 'ok', exams, date: '2026-11-03' })).toBe('CARE 100');
  expect(noteCourse(T, { text: 'ok', exams, date: '2026-12-01' })).toBe(null);
  expect(nextExamCourse(exams, '2026-11-01')).toBe('LAND 200');
  expect(nextExamCourse([{ course: 'LAND 200', date: '2026-11-02', status: 'done' }], '2026-11-01')).toBe(null);
});

test('a note’s title and body lose nothing he wrote', () => {
  expect(noteParts('Short line\r\nthe rest\nmore')).toEqual({
    title: 'Short line',
    body: 'the rest\nmore',
  });
  const long = 'word '.repeat(30).trim();
  const p = noteParts(long, { max: 20 });
  expect(p.title.endsWith('…')).toBe(true);
  expect(p.title.length).toBeLessThanOrEqual(20);
  expect(p.body).toBe(long);
});

test('a Today task’s course and what Start does', () => {
  expect(taskCourse(T, { text: 'Read about dunes' })).toBe('LAND 200');
  expect(taskCourse(T, { text: 'Read about dunes' }, { known: 'CARE 100' })).toBe('CARE 100');
  expect(taskCourse(T, { text: 'plain' })).toBe(null);
  expect(taskStart({ ref: 'sets/abc' })).toBe('set');
  expect(taskStart({ set: 'x' })).toBe('set');
  expect(taskStart({ minutes: 20, tag: 'DRILL' })).toBe('quiz');
  expect(taskStart({ minutes: 20, tag: 'READ' })).toBe('session');
  expect(taskStart({ tag: 'DRILL' })).toBe(null);
  expect(taskStart(null)).toBe(null);
});

test('exam framing: NCLEX only for a nursing course', () => {
  expect(examFrame(T, 'care 100').nursing).toBe(true);
  const land = examFrame(T, 'LAND 200');
  expect(land.nursing).toBe(false);
  expect(land.exam).toBe("LAND 200's lecture and field exams");
  expect(examFrame(T, null).exam).toBe('his exams');
  const text = 'Realistic NCLEX-style client scenarios; the NCLEX traps; NCLEX';
  expect(frameText(T, text, 'CARE 100')).toBe(text);
  const framed = frameText(T, text, 'LAND 200');
  expect(framed).not.toMatch(/NCLEX-style client|NCLEX traps/);
  expect(framed).toMatch(/LAND 200's lecture and field exams/);
  expect(frameText(T, 'NCLEX', null)).toBe('his exams');
  // the style words a replacement brings are not rewritten again
  expect(frameText(T, 'Write NCLEX-style items.', 'LAND 200')).toBe(
    'Write ' + examFrame(T, 'LAND 200').style + ' items.',
  );
});

test('the chat course and her teaching line', () => {
  expect(chatCourse(T, { note: 'land 200', exam: 'care 100' })).toBe('LAND 200');
  expect(chatCourse(T, { item: 'dunes', studyCourse: 'CARE 100' })).toBe('CARE 100');
  expect(chatCourse(T, {})).toBe(null);
  expect(teachLine(T, 'CARE 100')).toBe('when it shows up on the NCLEX');
  expect(teachLine(T, 'LAND 200')).toMatch(/\(this is LAND 200: no NCLEX or nursing-board tips\)/);
  expect(teachLine(T, null)).toMatch(/his exams/);
});
