import { defaultCourse } from './table.ts';
import type { CourseTable, ExamRef, ObjectiveRef, SpotRef, TaskRef } from './types.ts';

// Which course a weak spot, chat note or Today task belongs to, by one rule for every reader (ev4 B-498, B-497, B-517).

/** Letters and digits only, lower case: a course name in any spacing or case. */
const key = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const examCourse = (id: string | undefined, exams: ExamRef[]): string | null =>
  (id ? exams.find((x) => x?.id === id)?.course : undefined) || null;

/** An objective's exam: its own document's, else its id's prefix (E4-3 is E4's). */
const objectiveExam = (id: string | undefined, objectives: ObjectiveRef[]): string | null => {
  if (!id) return null;
  return objectives.find((x) => x?.id === id)?.exam || id.split('-')[0] || null;
};

/**
 * The course a weak spot counts toward: its objective's exam's course, else its exam's, else the course it was filed
 * under, else the default course. A spot filed under the wrong course shows under its own.
 */
export function spotCourse(
  table: CourseTable,
  w: SpotRef | null | undefined,
  { exams = [], objectives = [] }: { exams?: ExamRef[]; objectives?: ObjectiveRef[] } = {},
): string | null {
  return (
    examCourse(objectiveExam(w?.objective, objectives) ?? undefined, exams) ||
    examCourse(w?.exam, exams) ||
    w?.course ||
    defaultCourse(table)
  );
}

/** The course a line names: a course's own name (any spacing or case), else its guess words; null for none. */
export function namedCourse(table: CourseTable, text: unknown, { guess = true } = {}): string | null {
  const t = String(text ?? '');
  const k = key(t);
  const byName = table.find((c) => key(c.name) && k.includes(key(c.name)));
  if (byName) return byName.name;
  if (!guess) return null;
  return table.find((c) => c.guess && new RegExp(c.guess, 'i').test(t))?.name ?? null;
}

/** The course of the next exam on or after date that is not done; null when none. */
export function nextExamCourse(exams: ExamRef[] | null | undefined, date: string): string | null {
  const next = (exams ?? [])
    .filter((e) => e && DAY.test(String(e.date ?? '')) && (e.date as string) >= date && e.status !== 'done' && e.course)
    .sort((a, b) => (a.date as string).localeCompare(b.date as string))[0];
  return next?.course ?? null;
}

/**
 * A chat note's course: a course its own words name, else the conversation's (its recent lines, newest first: a course
 * named, then its guess words), else the next exam's. null when there is none of these.
 */
export function noteCourse(
  table: CourseTable,
  {
    text = '',
    recent = [],
    exams = [],
    date = '',
  }: {
    text?: string;
    recent?: string[];
    exams?: ExamRef[];
    date?: string;
  } = {},
): string | null {
  const lines = recent.map(String);
  return (
    namedCourse(table, text, { guess: false }) ||
    lines.map((l) => namedCourse(table, l, { guess: false })).find(Boolean) ||
    namedCourse(table, text) ||
    lines.map((l) => namedCourse(table, l)).find(Boolean) ||
    nextExamCourse(exams, date) ||
    null
  );
}

/**
 * A chat note's short title and its whole words: the title is its first line, cut at a word to at most `max`
 * characters with an ellipsis when longer; the body is the rest, or the whole text when the title was cut, so nothing
 * he wrote is lost.
 */
export function noteParts(text: unknown, { max = 80 } = {}): { title: string; body: string } {
  const all = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
  const nl = all.indexOf('\n');
  const first = (nl < 0 ? all : all.slice(0, nl)).replace(/\s+/g, ' ').trim();
  const rest = nl < 0 ? '' : all.slice(nl + 1).trim();
  if (first.length <= max) return { title: first, body: rest };
  const cut = first.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return {
    title: (at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, '') + '…',
    body: all,
  };
}

/** A Today task's course: the record's (passed as known), else a course its words name, else their guess words. */
export function taskCourse(table: CourseTable, it: TaskRef | null | undefined, { known = '' } = {}): string | null {
  const text = String(it?.text ?? '');
  return known || namedCourse(table, text, { guess: false }) || namedCourse(table, text) || null;
}

const QUIZ_TAGS = ['PRACTICE', 'DRILL'];
/**
 * What Start does for a Today task: 'set' opens the set it names; 'quiz' starts its course's quiz in place (a practice
 * or drill task with no set of its own); 'session' a study session (any other task with an estimate); null when it
 * can't start.
 */
export function taskStart(it: TaskRef | null | undefined): 'set' | 'quiz' | 'session' | null {
  if (!it) return null;
  if (it.set || /^sets\//.test(String(it.ref ?? ''))) return 'set';
  if (!(Number(it.minutes) > 0)) return null;
  return QUIZ_TAGS.includes(it.tag ?? '') ? 'quiz' : 'session';
}
