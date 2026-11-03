import { daysBetween } from '../time/index.ts';

// Exam document (ev4 exams schema 2, frozen in data/compat/schemas/exams.schema.json).
// The score lives in examedits and the prediction in predictions; neither is stored here.
export const EXAM_KINDS = ['unit', 'dosage', 'final', 'ati', 'lab'] as const;

export type Exam = {
  schema: 2;
  writer: 'canvas-sync' | 'page' | 'worker';
  at: string;
  source: string;
  title: string;
  kind: (typeof EXAM_KINDS)[number];
  course?: string;
  date?: string | null;
  status?: 'upcoming' | 'done';
  planId?: string | null;
};

const KEYS = new Set(['schema', 'writer', 'at', 'source', 'title', 'kind', 'course', 'date', 'status', 'planId']);
const str = (v: unknown) => typeof v === 'string' && v.length > 0;

/** Validates an exam document; throws on anything outside the frozen ev4 schema 2 (hand-written until zod is a recorded dependency). */
export function parseExam(raw: unknown): Exam {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('exam: not an object');
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!KEYS.has(k)) throw new Error(`exam: unexpected field ${k}`);
  if (o.schema !== 2) throw new Error('exam: schema must be 2');
  if (!['canvas-sync', 'page', 'worker'].includes(o.writer as string)) throw new Error('exam: bad writer');
  if (!str(o.at) || !str(o.source) || !str(o.title)) throw new Error('exam: at, source and title are required');
  if (!(EXAM_KINDS as readonly unknown[]).includes(o.kind)) throw new Error('exam: bad kind');
  if (o.course !== undefined && typeof o.course !== 'string') throw new Error('exam: bad course');
  if (o.date != null && !(typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date))) throw new Error('exam: bad date');
  if (o.status !== undefined && o.status !== 'upcoming' && o.status !== 'done') throw new Error('exam: bad status');
  if (o.planId != null && typeof o.planId !== 'string') throw new Error('exam: bad planId');
  return o as Exam;
}

/** An exam with no status counts as upcoming. */
export function isUpcoming(e: Exam): boolean {
  return (e.status ?? 'upcoming') === 'upcoming';
}

/** Whole Central days until the exam, or null when it has no date. */
export function examDaysLeft(e: Exam, today: string): number | null {
  return e.date ? daysBetween(today, e.date) : null;
}

/** Upcoming exams, dated ones first by date, undated last. */
export function sortUpcoming(exams: Exam[]): Exam[] {
  return exams
    .filter(isUpcoming)
    .sort((a, b) => (a.date ?? '9999') .localeCompare(b.date ?? '9999') || a.title.localeCompare(b.title));
}
