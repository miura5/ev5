// Set document (ev4 sets schema 3, frozen in data/compat/schemas/sets.schema.json). Items never change once written;
// answers live in their own collection keyed by set id and item id, so a set holds no answers.
export const SET_KINDS = ['review', 'drill', 'sim', 'more', 'job', 'check'] as const;
export const ITEM_TYPES = ['single', 'sata', 'matrix', 'numeric', 'open'] as const;
export const SET_WRITERS = ['morning', 'worker', 'page'] as const;

export type MatrixRow = { text: string; correct: number; rationale?: string };
export type KeyPoint = { text: string; keywords: string[][] };

export type SetItem = {
  id: string;
  stem: string;
  kind?: string;
  type?: (typeof ITEM_TYPES)[number];
  options?: string[];
  correct?: number[];
  rationales?: string[];
  matrix?: { columns: string[]; rows: MatrixRow[] };
  answer?: number;
  unit?: string;
  tolerance?: number;
  steps?: string[];
  weakspotId?: string;
  objective?: string;
  topic?: string;
  cjStep?: string;
  verify?: boolean;
  sourceRef?: string | null;
  chapters?: (string | number)[] | string;
  keyPoints?: KeyPoint[];
  modelAnswer?: string;
};

export type StudySet = {
  schema: 3;
  writer: (typeof SET_WRITERS)[number];
  at: string;
  source: string;
  kind: (typeof SET_KINDS)[number];
  items: SetItem[];
  title?: string;
  date?: string;
  exam?: string | null;
  planTaskId?: string;
  objectives?: string[];
  focus?: string | string[] | null;
  asked?: number;
  createdAt?: string;
};

/** One answer to an item: the options chosen (single, sata), or one column per row (matrix). */
export type Chosen = number[];

/** An answers document's `answers` map: item id -> attempt key -> attempt. */
export type SetAnswers = Record<string, Record<string, { at: string; correct?: boolean }>>;
