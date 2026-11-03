// A course rule (ev4 spec.courses.<name>). Course facts are data: no course is named in code (§data.course-facts).
export type LibraryRule = { module: string; kind: string; only?: string };

export type CourseRule = {
  name: string;
  canvasId: number;
  status: 'active' | 'done';
  endsAfter?: string;
  examKinds: string[];
  reviewKinds: string[];
  examDayKinds: string[];
  scoredKinds: string[];
  calendarDayKinds: string[];
  dayBudget: 'shared';
  aliases?: string;
  guess?: string;
  default?: boolean;
  library: LibraryRule[];
  planModule?: { module: string; exam: string };
  /** True on a nursing course: the only flag that gives NCLEX framing in prompts. */
  nursing?: boolean;
  /** Names a non-nursing course's own exams, which its prompts frame by. */
  exams?: string;
};

export type CourseTable = readonly CourseRule[];

/** The slice of an exam document the course rules read (the id is its document key). */
export type ExamRef = {
  id?: string;
  course?: string;
  date?: string | null;
  status?: string;
};
/** The slice of an objective document the course rules read. */
export type ObjectiveRef = { id?: string; exam?: string };
/** The slice of a weak spot the course rules read. */
export type SpotRef = { objective?: string; exam?: string; course?: string };
/** The slice of a Today task the course rules read. */
export type TaskRef = {
  text?: string;
  set?: unknown;
  ref?: string;
  minutes?: number;
  tag?: string;
};
