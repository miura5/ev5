/** The shapes Today shows, restated here: areas never import data or jobs. */
export type CourseTone = "ok" | "info" | "warn" | "bad";

export interface PlanItem {
  id: string;
  title: string;
  meta: string;
  /** "10m": the one value on the right. */
  est: string;
  done: boolean;
  tone: CourseTone;
}

export interface Readiness {
  /** Shares of the three bands, in percent; they add up to 100. */
  ready: number;
  shaky: number;
  weak: number;
}

export interface UpcomingDate {
  id: string;
  title: string;
  meta: string;
  /** "Thu" or "Nov 9". */
  when: string;
  tone: CourseTone;
  readiness: Readiness;
  /** "Thursday, Nov 5", for the Detail panel. */
  whenFull?: string;
  /** The date and days left for the Detail, worded as Library words it: "Thu, Nov 12 · in 8 days". */
  dateLine?: string;
  /** The date's kind, a key of the kind registry ("exam", "other"); what it offers comes from there. */
  kind: string;
  /** The prep plan for this exam: waiting for his answer, or approved and in force. */
  plan?: "waiting" | "approved" | "working";
  /** The plan's sessions by day (the waiting draft's, or the plan in force's). */
  sessions?: readonly { date: string; title: string; minutes: number }[];
}

export interface ThisWeekItem {
  id: string;
  title: string;
  meta: string;
  when: string;
}

export interface Proposal {
  text: string;
}

export interface TodayProps {
  /** "Monday, November 2". */
  dateLabel: string;
  /** E.V.'s one line: the lead words come up to text. */
  say: { lead: string; rest: string; source?: string };
  plan: PlanItem[];
  /** The one line shown when spend passes 80% of the monthly limit. */
  alert?: string;
  proposal?: Proposal;
  upcoming: UpcomingDate[];
  thisWeek: ThisWeekItem[];
  selectedId?: string;
  onStartNext: () => void;
  onOpen: (id: string) => void;
  /** The tick on a plan item: `done` is the state it should have afterwards. */
  onTick: (id: string, done: boolean) => void;
  /** Add a plan item for today (plan.create); resolves false when it could not be saved. */
  onAddPlan: (title: string) => Promise<boolean>;
  /** Add a date (date.create); `date` is "YYYY-MM-DD". Resolves false when it could not be saved. */
  onAddDate: (title: string, date: string) => Promise<boolean>;
  onAccept: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}
