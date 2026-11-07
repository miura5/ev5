import {
  accuracyLine,
  centralDate,
  dueCounts,
  inDays,
  daysBetween,
  plainDay,
  planEnded,
} from "../../domain/index.ts";
import type { SetTableRow } from "../../domain/index.ts";
import { tallyDocs } from "./attempts.ts";
import { questionOf } from "./questions.ts";
import { spotsOf, type SpotRows } from "./weakSpots.ts";
import type {
  Accuracy,
  LibraryExam,
  LibrarySet,
  Mastery,
  PlanSession,
  PlanState,
  SetPageData,
  WeakSpot,
} from "./types.ts";

import type {
  parsePlanItemTableRow,
  parsePlanTableRow,
} from "../../domain/index.ts";

/** A plans row as GET /plans returns it (§data.gate). */
export type PlanRow = ReturnType<typeof parsePlanTableRow>;
/** A plan_items row as GET /plan-items returns it. */
export type PlanItemRow = ReturnType<typeof parsePlanItemTableRow>;

/** The rows as the GET routes return them (§data.gate): goals, weak spots, their events and links come from SpotRows. */
export interface LibraryDocs extends SpotRows {
  /** GET /sets; a set's questions are the GET /items rows (SpotRows.items) with its id. */
  sets: SetTableRow[];
  /** The unfinished jobs (GET /jobs); a prep plan waiting at needs-you names its exam. */
  jobs?: WireJob[];
  /** GET /plans (goal, state: in force, put away or a draft); absent reads as none. */
  plans?: PlanRow[];
  /** GET /plan-items (plan, day, title, minutes): a plan's sessions. */
  planItems?: PlanItemRow[];
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

/** The sessions of a plan: its plan_items rows (the day is the item's day). */
function sessionsOfPlan(
  items: PlanItemRow[] | undefined,
  planId?: string,
): PlanSession[] {
  if (!planId) return [];
  return sessionsOf(
    (items ?? [])
      .filter((i) => i.plan_id === planId)
      .map((i) => ({ date: i.day, title: i.title, minutes: i.minutes })),
  );
}

/** The plan a date points at, from its plans rows: the one in force, else a draft, else the one put away last. */
function planIdOf(plans: PlanRow[] | undefined, goal: string) {
  const rank: Record<string, number> = { in_force: 3, draft: 2, put_away: 1 };
  let best: { id: string; r: number; at: number } | undefined;
  for (const p of plans ?? []) {
    const r = p.goal_id === goal ? (rank[p.state] ?? 0) : 0;
    if (r && (!best || r > best.r || (r === best.r && p.at >= best.at)))
      best = { id: p.id, r, at: p.at };
  }
  return best?.id;
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
  state: unknown,
  sessions: readonly PlanSession[],
  today: string,
): PlanState {
  if (!planId) return "none";
  // A plan past its last day is over, not in force, even though it is still the one the exam points at.
  if (state === "in_force")
    return planEnded(
      sessions.map((s) => s.date),
      today,
    )
      ? "ended"
      : "approved";
  if (state === "put_away") return "away";
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

const share = (n: number, of: number) => (of > 0 ? n / of : 0);

/** Maps the three collections Library reads to the views' props; no data gives empty lists. */
export function mapLibrary(docs: LibraryDocs, now: Date | number): LibraryData {
  const today = centralDate(now);
  const spots = spotsOf(docs);
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
        goalId: v.exam ?? null,
      };
    });
  const stateOfPlan = (id: string | undefined): unknown =>
    docs.plans?.find((p) => p.id === id)?.state;
  const exams: LibraryExam[] = docs.goals
    .filter((g) => g.status === "open")
    .sort(
      (a, b) =>
        (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
        a.title.localeCompare(b.title),
    )
    .map((v) => {
      const id = v.id;
      const job = waitingPlan(docs.jobs, id);
      const waiting = job?.id;
      const planId = waiting ?? planIdOf(docs.plans, id);
      const working = !waiting && workingPlan(docs.jobs, id);
      const sessions = waiting
        ? sessionsOf(job?.tasks)
        : working
          ? []
          : sessionsOfPlan(docs.planItems, planId);
      const mine = spots.filter(
        (s) => s.v.exam === id && ["open", "reviewed"].includes(s.d.status),
      );
      const ready = mine.filter((s) => s.d.status === "reviewed").length;
      const shaky = mine.filter(
        (s) => s.d.status === "open" && s.d.streak > 0,
      ).length;
      const left = v.date ? daysBetween(today, v.date) : null;
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
            : planStateOf(planId, stateOfPlan(planId), sessions, today),
        ...(planId ? { planId } : {}),
        ...(waiting ? { waiting: true } : {}),
        ...(sessions.length ? { sessions } : {}),
      };
    });
  const answered = tallyDocs(docs.attempts ?? []);
  const dues = dueCounts(answered);
  const sets: LibrarySet[] = [];
  const pages: Record<string, SetPageData> = {};
  for (const set of docs.sets) {
    const id = set.id;
    const title = set.title ?? `${set.kind} set`;
    const questions = (docs.items ?? [])
      .filter((i) => i.set_id === id)
      .sort((x, y) => x.pos - y.pos)
      .flatMap(questionOf);
    const n = questions.length;
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
      items: questions.map((q) => ({
        id: q.id,
        front: q.stem,
        back:
          q.correct
            .map((i) => q.options[i])
            .filter(Boolean)
            .join("; ") || undefined,
        ...(q.type === "open" ? { open: true } : {}),
        ...(q.options.length && !["open", "numeric"].includes(q.type)
          ? { options: q.options, multi: q.type === "multi_select" }
          : {}),
      })),
    };
  }
  return {
    weakSpots,
    exams,
    sets,
    accuracy: accuracyLine(answered, Number(now)),
    pages,
  };
}
