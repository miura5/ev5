import type { AttemptRow, SetItemRow, WireDoc } from "../../domain/index.ts";

export type { WireDoc };
export interface TodayDocs {
  exams: WireDoc[];
  weakspots: WireDoc[];
  /** GET /attempts and GET /items: an answer counts for the weak spot its item is aimed at. Absent reads as none. */
  attempts?: AttemptRow[];
  items?: SetItemRow[];
  /** The unfinished jobs (GET /jobs); a prep plan waiting at needs-you names its exam. */
  jobs?: readonly WireJobLine[];
  /** The plans rows (goal, state); a goal's plan in force is its approved plan. Absent reads as none. */
  plans?: WireDoc[];
  /** The plan_items rows (plan, day, title, minutes, origin, tick): a plan's tasks and the items Matt added. */
  planItems?: WireDoc[];
}

/** One entry of GET /api/v1/jobs, restated: only what the spend alert line needs. */
export interface WireJobLine {
  kind: string;
  state: string;
  summary: string;
  /** The exam a prep plan job is for (GET /jobs names it). */
  goalId?: string;
  /** The draft's sessions, if the server sends them. */
  tasks?: unknown;
}

/** One proposed or planned session: a Central date (YYYY-MM-DD), what to do and how long. */
export interface ExamSession {
  date: string;
  title: string;
  minutes: number;
}

function sessionsOf(tasks: unknown): ExamSession[] {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter(
      (t): t is ExamSession =>
        !!t &&
        typeof t.date === "string" &&
        typeof t.title === "string" &&
        typeof t.minutes === "number",
    )
    .map(({ date, title, minutes }) => ({ date, title, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The sessions the exam's plan lists, as Library words them: the waiting draft's, else the plan in force's. */
export function examSessions(id: string, docs: TodayDocs): ExamSession[] {
  const state = planOf(id, docs);
  if (state === "waiting") {
    const job = (docs.jobs ?? []).find(
      (j) =>
        j.kind.replace(/_/g, "-") === "prep-plan" &&
        j.state === "needs-you" &&
        j.goalId === id,
    );
    return sessionsOf(job?.tasks);
  }
  if (state !== "approved") return [];
  const plan = inForce(docs, id);
  return sessionsOf(
    itemsOf(docs, plan).map((i) => ({
      date: i.day,
      title: i.title,
      minutes: i.minutes,
    })),
  );
}

type Item = {
  id: string;
  day: string;
  title: string;
  minutes?: number;
  done: boolean;
};

/** The plan in force for a goal: its plans row in state in_force. */
function inForce(docs: TodayDocs, goalId: string): string | undefined {
  return docs.plans?.find((p) => {
    const d = p.data as { goal_id?: unknown; state?: unknown } | undefined;
    return d?.goal_id === goalId && d.state === "in_force";
  })?.id;
}

/** A plan's items, by day. The id is the row id: the key a tick is saved under. */
function itemsOf(docs: TodayDocs, planId: string | undefined): Item[] {
  if (!planId) return [];
  return (docs.planItems ?? []).flatMap((i) => {
    const d = i.data as
      | {
          plan_id?: unknown;
          day?: unknown;
          title?: unknown;
          minutes?: unknown;
          done_at?: unknown;
        }
      | undefined;
    return d?.plan_id === planId &&
      typeof d.day === "string" &&
      typeof d.title === "string"
      ? [
          {
            id: i.id,
            day: d.day,
            title: d.title,
            done: typeof d.done_at === "number",
            ...(typeof d.minutes === "number" ? { minutes: d.minutes } : {}),
          },
        ]
      : [];
  });
}

/** The exam's plan line: waiting when a prep plan job names this exam, approved when its plan is in force. */
export function planOf(
  id: string,
  docs: TodayDocs,
): "waiting" | "approved" | "working" | undefined {
  const waits = (docs.jobs ?? []).some(
    (j) =>
      j.kind.replace(/_/g, "-") === "prep-plan" &&
      j.state === "needs-you" &&
      j.goalId === id,
  );
  if (waits) return "waiting";
  // Right after Matt's answer the job still runs: the exam may point at an earlier plan until it lands.
  const working = (docs.jobs ?? []).some(
    (j) =>
      j.kind.replace(/_/g, "-") === "prep-plan" &&
      j.state === "running" &&
      j.goalId === id,
  );
  if (working) return "working";
  return inForce(docs, id) ? "approved" : undefined;
}

export type Session = {
  id: string;
  text: string;
  minutes?: number;
  kind: string;
  done: boolean;
};

/** Today's sessions from the plans in force: each task dated today (Central), keyed by its task id so a tick sticks. */
export function planSessions(
  docs: TodayDocs,
  goalIds: string[],
  today: string,
): Session[] {
  return goalIds.flatMap((goalId) => {
    if (planOf(goalId, docs) !== "approved") return [];
    return itemsOf(docs, inForce(docs, goalId))
      .filter((i) => i.day === today)
      .map((i) => ({
        id: i.id,
        text: i.title,
        kind: "plan",
        done: i.done,
        ...(i.minutes !== undefined ? { minutes: i.minutes } : {}),
      }));
  });
}

/** The items Matt added for a day (origin user or the morning job's): rows without a plan. */
export function addedSessions(docs: TodayDocs, today: string): Session[] {
  return (docs.planItems ?? []).flatMap((i) => {
    const d = i.data as
      | {
          plan_id?: unknown;
          day?: unknown;
          title?: unknown;
          minutes?: unknown;
          done_at?: unknown;
          origin?: unknown;
        }
      | undefined;
    return d?.plan_id == null && d?.day === today && typeof d.title === "string"
      ? [
          {
            id: i.id,
            text: d.title,
            kind: "todo",
            done: typeof d.done_at === "number",
            ...(typeof d.minutes === "number" ? { minutes: d.minutes } : {}),
          },
        ]
      : [];
  });
}
