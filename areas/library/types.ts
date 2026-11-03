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
}

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
