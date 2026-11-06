import { expect, test } from 'vitest';
import { parseCourseTable } from './index.ts';

// The courses are made up and live only in this fixture (§what.framing).
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
  'ART 100': {
    ...rule,
    canvasId: 1001,
    examKinds: ['unit', 'final'],
    reviewKinds: ['unit', 'final'],
    examDayKinds: ['unit', 'final'],
    scoredKinds: ['unit'],
    aliases: '^art\\s*100$',
    default: true,
  },
  'LAND 200': {
    ...rule,
    canvasId: 2002,
    examKinds: ['unit', 'lab', 'final'],
    reviewKinds: ['unit', 'lab', 'final'],
    examDayKinds: ['unit', 'lab', 'final'],
    aliases: '^land\\s*200$',
    guess: '\\b(land\\s*200|soil|erosion|dune\\w*)\\b',
  },
};

test('the table reads, skips notes, and refuses a broken one', () => {
  expect(parseCourseTable(RAW).map((c) => c.name)).toEqual(['ART 100', 'LAND 200']);
  const broken = structuredClone(RAW) as unknown as Record<string, Record<string, unknown>>;
  delete broken['ART 100']!.default;
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
