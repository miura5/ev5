import { namedCourse } from './scope.ts';
import type { CourseTable } from './types.ts';

// How E.V.'s prompts frame material by exam for the course in context. NCLEX and next-gen framing belong to
// a course flagged nursing only; another course frames by its own exams; no course known gets neutral framing.

type ExamFrame = {
  nursing: boolean;
  exam: string;
  style: string;
  traps: string;
  scenarios: string;
};

export function examFrame(table: CourseTable, course?: string | null): ExamFrame {
  const name = course ? namedCourse(table, course, { guess: false }) : null;
  const e = name ? table.find((c) => c.name === name) : undefined;
  if (e?.nursing)
    return {
      nursing: true,
      exam: 'the NCLEX',
      style: 'NCLEX-style',
      traps: 'the NCLEX traps',
      scenarios: 'Realistic NCLEX-style client scenarios',
    };
  const exams = e ? (e.exams ?? `${e.name}'s exams`) : 'his exams';
  return {
    nursing: false,
    exam: exams,
    style: e ? `${e.name} exam-style (${exams}; no NCLEX or nursing-board framing)` : 'exam-style',
    traps: `the common traps on ${exams}`,
    scenarios: e ? `Questions in the style of ${exams}, no NCLEX framing` : 'Realistic exam-style questions',
  };
}

/** A guide or rule text with its NCLEX wording reframed for the course in context (a nursing course keeps it). */
export function frameText(table: CourseTable, text: string, course?: string | null): string {
  const f = examFrame(table, course);
  if (f.nursing || typeof text !== 'string') return text;
  // One pass, longest phrase first: a replacement that itself mentions NCLEX is never rewritten again.
  const to = (m: string) =>
    m === 'Realistic NCLEX-style client scenarios'
      ? f.scenarios
      : m === 'the NCLEX traps'
        ? f.traps
        : m.startsWith('(NCLEX and next-gen style')
          ? '(' + f.style + ')'
          : m === 'NCLEX-style'
            ? f.style
            : m === 'the NCLEX' || m === 'NCLEX'
              ? f.exam
              : m;
  return text.replace(
    /Realistic NCLEX-style client scenarios|the NCLEX traps|\(NCLEX and next-gen style[^)]*\)|NCLEX-style|the NCLEX|NCLEX/g,
    to,
  );
}

/**
 * The course a chat reply is framed by. The open note's course first; with no note, the course of the item or exam
 * being discussed, then the view's selected course; null only when none is known.
 */
export function chatCourse(
  table: CourseTable,
  { note, item, exam, studyCourse }: { note?: string; item?: string; exam?: string; studyCourse?: string } = {},
): string | null {
  const pick = (c?: string) => (c ? namedCourse(table, c, { guess: false }) : null);
  return pick(note) || pick(item) || pick(exam) || pick(studyCourse) || null;
}

/** Her teaching line, framed by the course in context. */
export function teachLine(table: CourseTable, course?: string | null): string {
  const f = examFrame(table, course);
  return course && f.exam !== 'his exams'
    ? 'when it shows up on ' + f.exam + (f.nursing ? '' : ' (this is ' + course + ': no NCLEX or nursing-board tips)')
    : "when it shows up on his exams (NCLEX framing only for a nursing course's content)";
}
