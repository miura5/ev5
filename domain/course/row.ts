// A course row: one entry of ev4's spec.courses with its name, as a Zod shape (the same rules parseCourseTable holds by
// hand). Extra keys are kept, as the table parser keeps them. Course facts are data: no course is named here (§data.course-facts).
import { z } from 'zod';

const pattern = (s: string): boolean => {
  try {
    new RegExp(s, 'i');
    return true;
  } catch {
    return false;
  }
};
const patternText = z.string().refine(pattern, 'is not a pattern');
const kinds = z.array(z.string());

const libraryRuleSchema = z.looseObject({
  module: patternText.refine((s) => s.length > 0, 'needs a module'),
  kind: z.string().min(1),
  only: patternText.optional(),
});

export const courseRowSchema = z
  .looseObject({
    name: z.string().min(1),
    canvasId: z.number().int(),
    status: z.enum(['active', 'done']),
    endsAfter: z.string().optional(),
    examKinds: kinds.min(1),
    reviewKinds: kinds,
    examDayKinds: kinds,
    scoredKinds: kinds,
    calendarDayKinds: kinds,
    dayBudget: z.literal('shared'),
    aliases: patternText.optional(),
    guess: patternText.optional(),
    default: z.boolean().optional(),
    library: z.array(libraryRuleSchema),
    planModule: z.strictObject({ module: z.string(), exam: z.string() }).optional(),
    nursing: z.boolean().optional(),
    exams: z.string().optional(),
  })
  .superRefine((c, ctx) => {
    for (const k of ['reviewKinds', 'examDayKinds', 'scoredKinds'] as const)
      if (c[k].some((x) => !c.examKinds.includes(x)))
        ctx.addIssue({ code: 'custom', path: [k], message: `${k} is not a list of its examKinds` });
  });
export type CourseRow = z.infer<typeof courseRowSchema>;

/** Validates one course row; throws naming each problem. */
export function parseCourseRow(raw: unknown): CourseRow {
  return courseRowSchema.parse(raw);
}
