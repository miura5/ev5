// A course rule: one row of the course table. Course facts are data: no course is named in code (§what.framing).
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
};

export type CourseTable = readonly CourseRule[];
