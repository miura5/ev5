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
