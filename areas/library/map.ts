import {
  centralDate,
  itemType,
  inDays,
  deriveWeakSpot,
  goalDaysLeft,
  parseGoal,
  parseSet,
  parseWeakSpot,
  plainDay,
  planEnded,
} from "../../domain/index.ts";
import { accuracyLine, dueCounts } from "../../domain/index.ts";
import type {
  Accuracy,
  LibraryExam,
  LibrarySet,
  Mastery,
  PlanSession,
  PlanState,
  SetPageData,
  WireDoc,
  WeakSpot,
} from "./types.ts";

export type { WireDoc } from "./types.ts";

export interface LibraryDocs {
  exams: WireDoc[];
  weakspots: WireDoc[];
  sets: WireDoc[];
  /** Practice answers; absent reads as none. */
  answers?: WireDoc[];
  /** Which prep plan is in force or put away per exam; absent reads as none. */
  planedits?: WireDoc[];
  /** The unfinished jobs (GET /jobs); a prep plan waiting at needs-you names its exam. */
  jobs?: WireJob[];
  /** The approved plans (ev4 `plans` documents): days of tasks, which an exam's planId points at. */
  plans?: WireDoc[];
}

/** One entry of GET /api/v1/jobs as Library reads it, restated: areas never import the server. */
export interface WireJob {
  id: string;
  kind: string;
  state: string;
  goalId?: string;
  /** The draft's sessions, if the server sends them. */
  tasks?: unknown;
}

/** The prep plan job waiting for this exam, if any. */
function waitingPlan(jobs: WireJob[] | undefined, exam: string) {
  return jobs?.find(
    (j) =>
      j.kind.replace(/-/g, "_") === "prep_plan" &&
      j.state === "needs-you" &&
      j.goalId === exam,
  );
}

/** The sessions a job carries, by day; anything that is not a dated, titled, timed session is left out. */
function sessionsOf(tasks: unknown): PlanSession[] {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter(
      (t): t is PlanSession =>
        !!t &&
        typeof t.date === "string" &&
        typeof t.title === "string" &&
        typeof t.minutes === "number",
    )
    .map(({ date, title, minutes }) => ({ date, title, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The sessions of an approved plan document (days of tasks); the day is the task's date. */
function sessionsOfPlan(
  plans: WireDoc[] | undefined,
  planId?: string,
): PlanSession[] {
  const d = plans?.find((p) => p.id === planId)?.data as
    | { days?: unknown }
    | undefined;
  if (!planId || !Array.isArray(d?.days)) return [];
  return sessionsOf(
    d.days.flatMap((day: { date?: unknown; tasks?: unknown }) =>
      Array.isArray(day?.tasks)
        ? day.tasks.map((t: { text?: unknown; minutes?: unknown }) => ({
            date: day.date,
            title: t?.text,
            minutes: t?.minutes,
          }))
        : [],
    ),
  );
}

interface PlanEdit {
  plan?: string;
  retired?: Record<string, unknown>;
}

function planIdOf(exams: WireDoc[], id: string): string | undefined {
  const d = exams.find((x) => x.id === id)?.data as
    | { planId?: unknown }
    | undefined;
  return typeof d?.planId === "string" && d.planId ? d.planId : undefined;
}

/** A prep plan job E.V. is still running for this exam: after Matt's answer the plan is not in force yet. */
function workingPlan(jobs: WireJob[] | undefined, exam: string): boolean {
  return !!jobs?.some(
    (j) =>
      j.kind.replace(/-/g, "_") === "prep_plan" &&
      j.state === "running" &&
      j.goalId === exam,
  );
}

function planStateOf(
  planId: string | undefined,
  e: PlanEdit | undefined,
  sessions: readonly PlanSession[],
  today: string,
): PlanState {
  if (!planId) return "none";
  // A plan past its last day is over, not in force, even though it is still the one the exam points at.
  if (e?.plan === planId)
    return planEnded(
      sessions.map((s) => s.date),
      today,
    )
      ? "ended"
      : "approved";
  if (e?.retired && planId in e.retired) return "away";
  return "draft";
}

export interface LibraryData {
  weakSpots: WeakSpot[];
  exams: LibraryExam[];
  sets: LibrarySet[];
  /** First-try accuracy line; null until something was answered in the last 14 days. */
  accuracy: Accuracy | null;
  /** Full pages by set id, for the set page when one is opened. */
  pages: Record<string, SetPageData>;
}

function tryParse<T>(
  parse: (raw: unknown) => T,
  d: WireDoc,
): { id: string; v: T }[] {
  try {
    return [{ id: d.id, v: parse(d.data) }];
  } catch {
    return []; // a document outside the schema is left out, never an error on Library
  }
}

const share = (n: number, of: number) => (of > 0 ? n / of : 0);

/** Maps the three collections Library reads to the views' props; no data gives empty lists. */
export function mapLibrary(docs: LibraryDocs, now: Date | number): LibraryData {
  const today = centralDate(now);
  const spots = docs.weakspots
    .flatMap((d) => tryParse(parseWeakSpot, d))
    .map((s) => ({ ...s, d: deriveWeakSpot(s.v, [], { id: s.id }) }));
  const weakSpots: WeakSpot[] = spots
    .filter((s) => s.d.status === "open")
    .sort(
      (a, b) => b.d.misses - a.d.misses || a.v.topic.localeCompare(b.v.topic),
    )
    .map(({ id, v, d }) => {
      const total = d.streak + d.misses;
      const mastery: Mastery = {
        right: share(d.streak, total),
        shaky: 0,
        wrong: total ? share(d.misses, total) : 1,
      };
      const due = d.nextDue
        ? d.nextDue <= today
          ? "due today"
          : `due ${plainDay(d.nextDue, today)}`
        : "";
      return {
        id,
        title: v.topic,
        meta: `${d.misses} missed`,
        mastery,
        due,
      };
    });
  const edits = new Map(
    (docs.planedits ?? []).map((p) => [p.id, (p.data ?? {}) as PlanEdit]),
  );
  const exams: LibraryExam[] = docs.exams
    .flatMap((d) => tryParse(parseGoal, d))
    .filter((e) => (e.v.status ?? "upcoming") === "upcoming")
    .sort(
      (a, b) =>
        (a.v.date ?? "9999").localeCompare(b.v.date ?? "9999") ||
        a.v.title.localeCompare(b.v.title),
    )
    .map(({ id, v }) => {
      const job = waitingPlan(docs.jobs, id);
      const waiting = job?.id;
      const planId = waiting ?? planIdOf(docs.exams, id);
      const working = !waiting && workingPlan(docs.jobs, id);
      const sessions = waiting
        ? sessionsOf(job?.tasks)
        : working
          ? []
          : sessionsOfPlan(docs.plans, planId);
      const mine = spots.filter(
        (s) => s.v.exam === id && ["open", "reviewed"].includes(s.d.status),
      );
      const ready = mine.filter((s) => s.d.status === "reviewed").length;
      const shaky = mine.filter(
        (s) => s.d.status === "open" && s.d.streak > 0,
      ).length;
      const left = goalDaysLeft(v, today);
      const when = v.date
        ? `${plainDay(v.date, today)}${left !== null && left >= 0 ? ` · ${inDays(left)}` : ""}`
        : "no date";
      return {
        id,
        title: v.title,
        meta: when,
        when,
        kind: v.kind,
        mastery: {
          right: share(ready, mine.length),
          shaky: share(shaky, mine.length),
          wrong: share(mine.length - ready - shaky, mine.length),
        },
        readiness: mine.length
          ? `${Math.round(share(ready, mine.length) * 100)}%`
          : "",
        // A plan still waiting for his answer has no document yet: it is a draft, and its job id stands for it.
        planState: waiting
          ? "draft"
          : working
            ? "working"
            : planStateOf(planId, edits.get(id), sessions, today),
        ...(planId ? { planId } : {}),
        ...(waiting ? { waiting: true } : {}),
        ...(sessions.length ? { sessions } : {}),
      };
    });
  const dues = dueCounts(docs.answers ?? []);
  const sets: LibrarySet[] = [];
  const pages: Record<string, SetPageData> = {};
  for (const { id, v } of docs.sets.flatMap((d) => tryParse(parseSet, d))) {
    const title = v.title ?? `${v.kind} set`;
    const n = v.items.length;
    const meta = `${n} ${n === 1 ? "question" : "questions"}`;
    const nDue = dues.get(id) ?? 0;
    sets.push({
      id,
      title,
      kind: "questions",
      meta,
      ...(nDue ? { due: `${nDue} due` } : {}),
    });
    pages[id] = {
      id,
      title,
      kind: "questions",
      meta,
      items: v.items.map((q) => ({
        id: q.id,
        front: q.stem,
        back:
          (q.correct ?? [])
            .map((i) => q.options?.[i])
            .filter(Boolean)
            .join("; ") || undefined,
        ...(itemType(q) === "open" ? { open: true } : {}),
        ...(q.options?.length && !["open", "numeric"].includes(itemType(q))
          ? { options: q.options, multi: itemType(q) === "multi_select" }
          : {}),
      })),
    };
  }
  return {
    weakSpots,
    exams,
    sets,
    accuracy: accuracyLine(docs.answers ?? [], Number(now)),
    pages,
  };
}
