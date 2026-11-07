import {
  addDays,
  centralDate,
  inDays,
  deriveWeakSpot,
  goalDaysLeft,
  parseGoal,
  parseWeakSpot,
  plainDay,
  weekdayDay,
} from "../../domain/index.ts";
import type { Goal } from "../../domain/index.ts";
import type {
  PlanItem,
  ThisWeekItem,
  TodayProps,
  UpcomingDate,
} from "./types.ts";
import { attemptsBySpot } from "./attempts.ts";
import { addedSessions, examSessions, planOf, planSessions } from "./plans.ts";
import type { Session } from "./plans.ts";
import type { TodayDocs, WireDoc, WireJobLine } from "./plans.ts";

export type { TodayDocs, WireDoc, WireJobLine };

export type TodayData = Pick<
  TodayProps,
  "say" | "plan" | "upcoming" | "thisWeek" | "alert"
>;

/** A needs-you prep-plan job means a plan waits for Matt. */
export function prepPlanWaiting(jobs: readonly WireJobLine[]): boolean {
  return jobs.some(
    (j) => j.kind.replace(/_/g, "-") === "prep-plan" && j.state === "needs-you",
  );
}

/** The monthly spend alert is a needs-you job of kind "spend-alert"; Today shows its one line. */
export function spendAlertLine(
  jobs: readonly WireJobLine[],
): string | undefined {
  return jobs.find((j) => j.kind === "spend-alert" && j.state === "needs-you")
    ?.summary;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
function whenLabel(date: string, left: number, today: string): string {
  const at = new Date(`${date}T00:00:00Z`);
  return left < 7 ? (DAYS[at.getUTCDay()] ?? "") : plainDay(date, today);
}

function planItems(sessions: Session[]): PlanItem[] {
  return sessions.map((a) => ({
    id: a.id,
    title: a.text,
    meta: a.kind === "plan" ? "from your prep plan" : "added by you",
    est: a.minutes ? `${a.minutes}m` : "",
    done: a.done,
  }));
}

/** The E.V. line from the day's plan, open or done; none when the plan is empty. */
function planSay(plan: PlanItem[]): TodayData["say"] | undefined {
  if (plan.length === 0) return undefined;
  const left = plan.filter((p) => !p.done).length;
  return left === 0
    ? {
        lead: "Today's plan is done.",
        rest: `${plan.length} ${plan.length === 1 ? "item" : "items"} ticked off.`,
      }
    : {
        lead: `${left} ${left === 1 ? "item is" : "items are"} left on today's plan.`,
        rest: `${plan.length - left} done so far.`,
      };
}

/** Maps the documents Today reads to the view's props; no data gives the empty state, never an error. */
export function mapToday(docs: TodayDocs, now: Date | number): TodayData {
  const today = centralDate(now);
  const exams = docs.exams
    .flatMap((d) => tryParse(parseGoal, d))
    .map((e) => ({
      id: e.id,
      exam: e.v as Goal,
      left: goalDaysLeft(e.v, today),
    }))
    .filter(
      (e): e is { id: string; exam: Goal; left: number } =>
        e.left !== null && e.left >= 0,
    )
    .filter((e) => (e.exam.status ?? "upcoming") === "upcoming")
    .sort(
      (a, b) => a.left - b.left || a.exam.title.localeCompare(b.exam.title),
    );
  const answered = attemptsBySpot(docs.attempts, docs.items);
  const derived = docs.weakspots
    .flatMap((d) => tryParse(parseWeakSpot, d))
    .map((s) => ({
      ...s,
      d: deriveWeakSpot(s.v, answered.get(s.id) ?? [], { id: s.id }),
    }));
  const open = derived.filter((s) => s.d.status === "open");
  const upcoming: UpcomingDate[] = exams.map(({ id, exam, left }) => {
    const mine = derived.filter(
      (s) => s.v.exam === id && ["open", "reviewed"].includes(s.d.status),
    );
    const ready = mine.filter((s) => s.d.status === "reviewed").length;
    const shaky = mine.filter(
      (s) => s.d.status === "open" && s.d.streak > 0,
    ).length;
    const planLine = planOf(id, docs);
    return {
      id,
      title: exam.title,
      meta: [
        inDays(left),
        mine.length === 0
          ? "readiness none yet"
          : `${Math.round((100 * ready) / mine.length)}% ready`,
        ...(planLine
          ? [
              `prep plan ${planLine === "waiting" ? "waiting for you" : planLine === "working" ? "being saved" : "approved"}`,
            ]
          : []),
      ].join(" · "),
      ...(planLine ? { plan: planLine } : {}),
      sessions: examSessions(id, docs),
      when: whenLabel(exam.date as string, left, today),
      whenFull: weekdayDay(exam.date as string),
      dateLine: `${plainDay(exam.date as string, today)} · ${inDays(left)}`,
      kind: exam.kind,
      readiness: { ready, shaky, weak: mine.length - ready - shaky },
    };
  });
  const plan = planItems([
    ...planSessions(
      docs,
      docs.exams.map((d) => d.id),
      today,
    ),
    ...addedSessions(docs, today),
  ]);
  const weekEnd = addDays(today, 6);
  const thisWeek: ThisWeekItem[] = exams
    .filter((e) => (e.exam.date as string) <= weekEnd)
    .map(({ id, exam, left }) => ({
      id: `w-${id}`,
      title: exam.title,
      meta: exam.kind,
      when: whenLabel(exam.date as string, left, today),
    }));
  // The weekly review is a job that waits for Matt on Sunday; Today names it in This week while it does.
  const review = (docs.jobs ?? []).find(
    (j) =>
      j.kind.replace(/_/g, "-") === "weekly-review" && j.state === "needs-you",
  );
  if (review)
    thisWeek.push({
      id: "w-weekly-review",
      title: "Weekly review",
      meta: review.summary,
      when: "Sun",
    });
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
        : (planSay(plan) ?? {
            lead: "Nothing planned yet.",
            rest: "Your plan for today will appear here.",
          });
  return { say, plan, upcoming, thisWeek };
}
