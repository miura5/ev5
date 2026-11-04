import {
  addDays,
  centralDate,
  deriveWeakSpot,
  examDaysLeft,
  parseExam,
  parseWeakSpot,
} from "../../domain/index.ts";
import type { Exam } from "../../domain/index.ts";
import type {
  CourseTone,
  PlanItem,
  ThisWeekItem,
  TodayProps,
  UpcomingDate,
} from "./types.ts";

/** One document as GET /api/v1/docs returns it (server/doc-routes.ts), restated: areas never import the server. */
export interface WireDoc {
  id: string;
  data: unknown;
}

export interface TodayDocs {
  exams: WireDoc[];
  weakspots: WireDoc[];
  /** The dayedits document for today, when there is one. */
  dayedit?: WireDoc;
}

export type TodayData = Pick<
  TodayProps,
  "say" | "plan" | "upcoming" | "thisWeek" | "alert"
>;

/** One entry of GET /api/v1/jobs, restated: only what the spend alert line needs. */
export interface WireJobLine {
  kind: string;
  state: string;
  summary: string;
}

/** The monthly spend alert is a needs-you job of kind "spend-alert"; Today shows its one line. */
export function spendAlertLine(
  jobs: readonly WireJobLine[],
): string | undefined {
  return jobs.find((j) => j.kind === "spend-alert" && j.state === "needs-you")
    ?.summary;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const KINDS: Record<string, string> = {
  todo: "to do",
  reading: "reading",
  learn: "learn",
  practice: "practice",
  review: "review",
  notes: "notes",
  graded: "graded work",
  "skills-prep": "skills prep",
  "clinical-prep": "clinical prep",
};

function tryParse<T>(
  parse: (raw: unknown) => T,
  d: WireDoc,
): { id: string; v: T }[] {
  try {
    return [{ id: d.id, v: parse(d.data) }];
  } catch {
    return []; // a document outside the schema is left out, never an error on Today
  }
}

/** "Thu" inside the next week, else "Nov 9". */
function whenLabel(date: string, left: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  return left < 7
    ? (DAYS[at.getUTCDay()] ?? "")
    : `${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`;
}

const toneFor = (left: number): CourseTone =>
  left <= 3 ? "bad" : left <= 7 ? "warn" : "info";
const inDays = (n: number) =>
  n === 0 ? "today" : `in ${n} ${n === 1 ? "day" : "days"}`;

function planItems(doc: WireDoc | undefined): PlanItem[] {
  const o = (doc?.data ?? {}) as {
    added?: Record<string, { text: string; kind: string; minutes?: number }>;
    checks?: Record<string, unknown>;
    skipped?: Record<string, unknown>;
  };
  return Object.entries(o.added ?? {})
    .filter(([k]) => !o.skipped?.[k])
    .map(([k, a]) => ({
      id: k,
      title: a.text,
      meta: KINDS[a.kind] ?? a.kind,
      est: a.minutes ? `${a.minutes}m` : "",
      done: !!o.checks?.[k],
      tone: "ok" as const,
    }));
}

/** Maps the documents Today reads to the view's props; no data gives the empty state, never an error. */
export function mapToday(docs: TodayDocs, now: Date | number): TodayData {
  const today = centralDate(now);
  const exams = docs.exams
    .flatMap((d) => tryParse(parseExam, d))
    .map((e) => ({
      id: e.id,
      exam: e.v as Exam,
      left: examDaysLeft(e.v, today),
    }))
    .filter(
      (e): e is { id: string; exam: Exam; left: number } =>
        e.left !== null && e.left >= 0,
    )
    .filter((e) => (e.exam.status ?? "upcoming") === "upcoming")
    .sort(
      (a, b) => a.left - b.left || a.exam.title.localeCompare(b.exam.title),
    );
  const derived = docs.weakspots
    .flatMap((d) => tryParse(parseWeakSpot, d))
    .map((s) => ({ ...s, d: deriveWeakSpot(s.v, [], { id: s.id }) }));
  const open = derived.filter((s) => s.d.status === "open");
  const upcoming: UpcomingDate[] = exams.map(({ id, exam, left }) => {
    const mine = derived.filter(
      (s) => s.v.exam === id && ["open", "reviewed"].includes(s.d.status),
    );
    const ready = mine.filter((s) => s.d.status === "reviewed").length;
    const shaky = mine.filter(
      (s) => s.d.status === "open" && s.d.streak > 0,
    ).length;
    return {
      id,
      title: exam.title,
      meta: inDays(left),
      when: whenLabel(exam.date as string, left),
      tone: toneFor(left),
      readiness: { ready, shaky, weak: mine.length - ready - shaky },
    };
  });
  const weekEnd = addDays(today, 6);
  const thisWeek: ThisWeekItem[] = exams
    .filter((e) => (e.exam.date as string) <= weekEnd)
    .map(({ id, exam, left }) => ({
      id: `w-${id}`,
      title: exam.title,
      meta: exam.kind,
      when: whenLabel(exam.date as string, left),
    }));
  const weakest = [...open].sort((a, b) => b.d.misses - a.d.misses)[0];
  const next = exams[0];
  const cite = "from Weak spots";
  const say =
    next && next.left <= 7
      ? {
          lead: `${next.exam.title} is ${inDays(next.left)}.`,
          rest: weakest
            ? `Your weakest spot is ${weakest.v.topic}.`
            : "No weak spots are open.",
          source: weakest ? cite : undefined,
        }
      : weakest
        ? {
            lead: `${open.length} weak ${open.length === 1 ? "spot is" : "spots are"} open.`,
            rest: `Start with ${weakest.v.topic}.`,
            source: cite,
          }
        : {
            lead: "Nothing planned yet.",
            rest: "Your plan for today will appear here.",
          };
  return { say, plan: planItems(docs.dayedit), upcoming, thisWeek };
}
