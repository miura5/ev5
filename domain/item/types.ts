// One practice question as a set holds it. Items never change once written; answers are keyed by item id. The formats
// are general: one answer, select all, a matrix, a number answer and an open answer. No subject is built in.
export const ITEM_TYPES = ['single', 'sata', 'matrix', 'numeric', 'open'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export type KeyPoint = { text: string; keywords: string[][] };
export type MatrixRow = { text: string; correct: number; rationale?: string };

export type Item = {
  id: string;
  kind?: string;
  type?: ItemType;
  stem: string;
  options?: string[];
  correct?: number[];
  rationales?: string[];
  matrix?: { columns: string[]; rows: MatrixRow[] };
  /** A number answer: its value, its unit (any free text; none for a bare number) and how far off still counts. */
  answer?: number;
  unit?: string;
  tolerance?: number;
  steps?: string[];
  weakspotId?: string;
  objective?: string;
  topic?: string;
  verify?: boolean;
  sourceRef?: string | null;
  chapters?: (string | number)[] | string;
  keyPoints?: KeyPoint[];
  modelAnswer?: string;
};

/** Limits an open item keeps. */
export type OpenLimits = {
  stemMaxWords: number;
  keyPointsMin: number;
  keyPointsMax: number;
  keyPointMaxWords: number;
};

export const OPEN_LIMITS: OpenLimits = { stemMaxWords: 25, keyPointsMin: 2, keyPointsMax: 3, keyPointMaxWords: 12 };

/** Words in a text. */
export const wordCount = (t: unknown): number =>
  String(t ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

/** Lower case, letters and digits spaced: how options compare. */
export const norm = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
