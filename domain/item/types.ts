// Item (one practice question) as ev4 stores it inside a set: sets schema 3, items[], frozen in
// data/compat/schemas/sets.schema.json. Items never change once written; answers are keyed by item id.
export type ItemType = 'single' | 'sata' | 'matrix' | 'numeric' | 'open';

export type KeyPoint = { text: string; keywords: string[][] };
export type MatrixRow = { text: string; correct: number; rationale?: string };

/** The numbers an item's answer is worked from (a calculation item); never stored, only checked when written. */
export type Calc = Record<string, unknown>;

export type Item = {
  id: string;
  kind?: string;
  type?: ItemType;
  stem: string;
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
  calc?: Calc;
};

/** Limits an open item and its answer keep. */
export type OpenLimits = {
  stemMaxWords: number;
  keyPointsMin: number;
  keyPointsMax: number;
  keyPointMaxWords: number;
  answerMaxChars: number;
};

/** The item facts ev4 keeps in its spec; no course is named in code (§data.course-facts), so these are data. */
export type ItemConfig = {
  cjSteps: string[];
  units: string[];
  open: OpenLimits;
  dosage: { match: string; skip: string };
  /** Course names, for a set written for a course by its focus. */
  courses: string[];
};

export const ITEM_CONFIG: ItemConfig = {
  cjSteps: [
    'recognize-cues',
    'analyze-cues',
    'prioritize-hypotheses',
    'generate-solutions',
    'take-action',
    'evaluate-outcomes',
  ],
  units: [
    'mL',
    'L',
    'mg',
    'mcg',
    'g',
    'kg',
    'units',
    'mEq',
    'tablets',
    'capsules',
    'gtt/min',
    'mL/hr',
    'mg/kg',
    'mg/hr',
    'mcg/min',
    'units/hr',
  ],
  open: { stemMaxWords: 25, keyPointsMin: 2, keyPointsMax: 3, keyPointMaxWords: 12, answerMaxChars: 600 },
  dosage: {
    match:
      'dosage|dose calc|drug calc|med(ication)?[ -]?math|calculations?|dimensional analysis|IV (flow|rate)s?|infusion',
    skip: 'syllabus|calendar|schedule|drug cards?|medication tables?',
  },
  courses: [],
};

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
