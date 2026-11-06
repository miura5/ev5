import { z } from 'zod';

// Objective document (schema 1).
// Seeded from the material the user names, never invented (§ev.objectives). The document id is not part of the data.
export const objectiveSchema = z.strictObject({
  schema: z.literal(1),
  writer: z.enum(['worker', 'page']),
  at: z.string().min(1),
  source: z.string().min(1),
  exam: z.string().min(1),
  num: z.number().int().min(0).optional(),
  text: z.string().min(1),
  chapters: z.union([z.string(), z.array(z.union([z.string(), z.number().int()]))]).optional(),
});
export type Objective = z.infer<typeof objectiveSchema>;

/** The part of an exam the objective rules read. */
export type ExamRef = { id: string; course?: string };

/** Validates an objective document; throws on anything outside the frozen ev4 schema 1. */
export function parseObjective(raw: unknown): Objective {
  return objectiveSchema.parse(raw);
}

/** Course names compare as data: spaces ignored, case ignored ("nur112" is "NUR 112"). */
export function sameCourse(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) =>
    String(s ?? '')
      .replace(/\s+/g, '')
      .toUpperCase();
  return norm(a) === norm(b);
}

/** An exam's objectives, in their own order. */
export function objectivesOf<T extends { exam: string }>(objectives: T[], examId: string): T[] {
  return objectives.filter((o) => o.exam === examId);
}

/**
 * The objectives a day writes new checks on: the exam's own, in order, skipping any with an active weak spot,
 * at most `limit`.
 */
export function newCheckIds(
  objectives: { id: string; exam: string }[],
  examId: string,
  activeObjectiveIds: Iterable<string>,
  limit: number,
): string[] {
  const active = new Set(activeObjectiveIds);
  return objectivesOf(objectives, examId)
    .filter((o) => !active.has(o.id))
    .map((o) => o.id)
    .slice(0, limit);
}

/**
 * The objectives a practice item (or a proposed weak spot's pick) may carry: the exam's, else its course's; with
 * neither an exam nor a course named, every objective.
 */
export function candidateObjectives<T extends { id: string; exam: string }>(ctx: {
  exam?: ExamRef | null;
  course?: string | null;
  objectives?: T[];
  exams?: ExamRef[];
  courseOf?: (e: ExamRef) => string | undefined;
}): T[] {
  const { exam, course, objectives = [], exams = [], courseOf = (e: ExamRef) => e.course } = ctx;
  const own = exam ? objectives.filter((o) => o.exam === exam.id) : [];
  if (own.length) return own;
  if (!course) return exam ? [] : objectives.slice();
  return objectives.filter((o) => {
    const oe = exams.find((e) => e.id === o.exam);
    return !!oe && sameCourse(courseOf(oe), course);
  });
}

/**
 * An item's objective held to its candidates: kept when it is one, else the only candidate when there is exactly
 * one, else left off.
 */
export function withObjective<Q extends { objective?: string }>(q: Q, ids: string[]): Q {
  if (q.objective && ids.includes(q.objective)) return q;
  const { objective: _dropped, ...rest } = q;
  return (ids.length === 1 ? { ...rest, objective: ids[0] } : rest) as Q;
}
