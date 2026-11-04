/** How a topic or exam splits: shares of recent answers that were right, shaky and wrong (each 0..1). */
export interface Mastery {
  right: number;
  shaky: number;
  wrong: number;
}

/** The running practice session, one question in focus. */
export interface PracticeSession {
  title: string;
  question: string;
  options: readonly string[];
  /** 1-based position and the session's length. */
  position: number;
  total: number;
  source: string;
  /** A nudge that does not give the answer; shown only when he asks. */
  hint?: string;
}

export interface WeakSpot {
  id: string;
  title: string;
  /** Course and the recent tally, e.g. "NUR 112 · 4 of 9 right lately". */
  meta: string;
  mastery: Mastery;
  /** When it is next due, e.g. "due today". */
  due: string;
}

export interface LibraryExam {
  id: string;
  title: string;
  /** Date and plan state, e.g. "Thursday, Nov 5 · plan waiting for you". */
  meta: string;
  mastery: Mastery;
  /** Readiness, e.g. "58%". */
  readiness: string;
  /** The study plan's state: none yet, a draft waiting, in force, or put away. */
  planState?: PlanState;
  /** The plan document the state is about (absent when there is none yet). */
  planId?: string;
  /** The plan is still the job waiting for his answer; planId is then the job's id. */
  waiting?: boolean;
}

export type PlanState = "none" | "draft" | "approved" | "away";

export type SetKind = "cards" | "questions" | "steps";

/** A set as a Library tile. */
export interface LibrarySet {
  id: string;
  title: string;
  kind: SetKind;
  /** Course and size, e.g. "BIO 201 · 24 cards". */
  meta: string;
  /** Quiet value top right, e.g. "6 due"; empty when nothing is due. */
  due?: string;
}

/** The first-try accuracy line under the header, e.g. "72%, up from 66%". */
export interface Accuracy {
  text: string;
}

/** One item on a set page; step sets use only `front`. */
export interface SetItem {
  id: string;
  front: string;
  back?: string;
}

/** The set page in view mode. */
export interface SetPageData {
  id: string;
  title: string;
  kind: SetKind;
  meta: string;
  items: readonly SetItem[];
}

/** The set page in Edit mode: same data, every field editable. */
export type SetEditData = SetPageData;

/** One study card: the attempt comes first, then the back with its source. */
export interface StudyItem {
  id: string;
  /** Term, Question or Step 2. */
  kicker: string;
  front: string;
  back: string;
  /** Where the back came from; absent means "unverified". */
  from?: string;
  /** E.V.s one line shown with the back. */
  note?: string;
}

/** An exam as a date with its plan: properties plus E.V.s dashed session proposals. */
export interface ExamPlanData {
  id: string;
  title: string;
  /** Date and time, e.g. "Thursday, Nov 5 · 9:00 am". */
  when: string;
  course: string;
  readiness: string;
  /** Plan state, e.g. "plan waiting for you". */
  plan: string;
  planState?: PlanState;
  planId?: string;
  proposals: readonly { id: string; text: string }[];
}

/** One document as GET /api/v1/docs returns it (server/doc-routes.ts), restated: areas never import the server. */
export interface WireDoc {
  id: string;
  data: unknown;
}
