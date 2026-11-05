import { z } from 'zod';
import { daysBetween } from '../time/index.ts';

// Exam document (ev4 exams schema 2, frozen in data/compat/schemas/exams.schema.json).
// The score lives in examedits and the prediction in predictions; neither is stored here.
export const EXAM_KINDS = ['unit', 'dosage', 'final', 'ati', 'lab'] as const;

export const examSchema = z.strictObject({
  schema: z.literal(2),
  writer: z.enum(['canvas-sync', 'page', 'worker']),
  at: z.string().min(1),
  source: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(EXAM_KINDS),
  course: z.string().optional(),
  date: z.string().nullable().optional(),
  status: z.enum(['upcoming', 'done']).optional(),
  planId: z.string().nullable().optional(),
});
export type Exam = z.infer<typeof examSchema>;

/** Validates an exam document; throws on anything outside the frozen ev4 schema 2. */
export function parseExam(raw: unknown): Exam {
  return examSchema.parse(raw);
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
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.title.localeCompare(b.title));
}
