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
  onAccept: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}
