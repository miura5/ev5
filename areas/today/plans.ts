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
  /** The unfinished jobs (GET /jobs); a study plan waiting at needs-you names its exam. */
  jobs?: readonly WireJobLine[];
  /** Which study plan is in force per exam; absent reads as none. */
  planedits?: WireDoc[];
  /** The approved plans (ev4 `plans` documents): days of tasks, which an exam's planId points at. */
  plans?: WireDoc[];
}

/** One entry of GET /api/v1/jobs, restated: only what the spend alert line needs. */
export interface WireJobLine {
  kind: string;
  state: string;
  summary: string;
  /** The exam a study plan job is for (GET /jobs names it). */
  examId?: string;
  /** The draft's sessions, if the server sends them. */
  tasks?: unknown;
}

/** One proposed or planned study session: a Central date (YYYY-MM-DD), what to do and how long. */
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
        j.kind.replace(/_/g, "-") === "study-plan" &&
        j.state === "needs-you" &&
        j.examId === id,
    );
    return sessionsOf(job?.tasks);
  }
  if (state !== "approved") return [];
  const planId = (
    docs.exams.find((d) => d.id === id)?.data as { planId?: string }
  ).planId;
  const days = (
    docs.plans?.find((p) => p.id === planId)?.data as
      | { days?: unknown }
      | undefined
  )?.days;
  if (!Array.isArray(days)) return [];
  return sessionsOf(
    days.flatMap((day: { date?: unknown; tasks?: unknown }) =>
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

/** The exam's plan line: waiting when a study plan job names this exam, approved when its plan is in force. */
export function planOf(
  id: string,
  docs: TodayDocs,
): "waiting" | "approved" | "working" | undefined {
  const waits = (docs.jobs ?? []).some(
    (j) =>
      j.kind.replace(/_/g, "-") === "study-plan" &&
      j.state === "needs-you" &&
      j.examId === id,
  );
  if (waits) return "waiting";
  // Right after Matt's answer the job still runs: the exam may point at an earlier plan until it lands.
  const working = (docs.jobs ?? []).some(
    (j) =>
      j.kind.replace(/_/g, "-") === "study-plan" &&
      j.state === "running" &&
      j.examId === id,
  );
  if (working) return "working";
  const planId = (
    docs.exams.find((d) => d.id === id)?.data as
      | { planId?: unknown }
      | undefined
  )?.planId;
  const inForce = (
    docs.planedits?.find((d) => d.id === id)?.data as
      | { plan?: unknown }
      | undefined
  )?.plan;
  return typeof planId === "string" && planId && inForce === planId
    ? "approved"
    : undefined;
}

export type Session = {
  id: string;
  text: string;
  minutes?: number;
  kind: string;
};

/** Today's sessions from the plans in force: each task dated today (Central), keyed by its task id so a tick sticks. */
export function planSessions(
  docs: TodayDocs,
  examIds: string[],
  today: string,
): Session[] {
  return examIds.flatMap((examId) => {
    if (planOf(examId, docs) !== "approved") return [];
    const planId = (
      docs.exams.find((d) => d.id === examId)?.data as { planId?: string }
    ).planId;
    const days = (
      docs.plans?.find((p) => p.id === planId)?.data as
        | { days?: unknown }
        | undefined
    )?.days;
    if (!Array.isArray(days)) return [];
    return days.flatMap((day: { date?: unknown; tasks?: unknown }) =>
      day?.date === today && Array.isArray(day.tasks)
        ? day.tasks.flatMap(
            (t: { id?: unknown; text?: unknown; minutes?: unknown }) =>
              typeof t?.id === "string" && typeof t.text === "string"
                ? [
                    {
                      id: t.id,
                      text: t.text,
                      kind: "plan",
                      ...(typeof t.minutes === "number"
                        ? { minutes: t.minutes }
                        : {}),
                    },
                  ]
                : [],
          )
        : [],
    );
  });
}
