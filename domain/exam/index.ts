import { z } from 'zod';
import { daysBetween } from '../time/index.ts';

// Exam document: a dated goal. Its kind is a short free-text label ("midterm", "quiz"), not a fixed list, because what
// an exam is depends on the course (§data.course-facts). The score and the prediction are stored elsewhere, not here.

export const examSchema = z.strictObject({
  schema: z.literal(2),
  writer: z.enum(['canvas-sync', 'page', 'worker']),
  at: z.string().min(1),
  source: z.string().min(1),
  title: z.string().min(1),
  kind: z.string().regex(/\S/, 'kind must not be empty').max(40),
  course: z.string().optional(),
  date: z.string().nullable().optional(),
  status: z.enum(['upcoming', 'done']).optional(),
  planId: z.string().nullable().optional(),
});
export type Exam = z.infer<typeof examSchema>;

/** Validates an exam document; throws on anything outside its schema. */
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
