// Where the prep plan reads its date and weak spots and where an approved plan lands (ev4 docs collections).
// load: the date (`exams/<id>` or its goal row) plus the weak spots (rows, §data.tables) linked to that goal, derived with their `answers` as of Central today, with
// the active ones worst first (the order is code, CONTRACT §cmd.code-first). apply: the plan becomes `plans/plan-<job>`
// (what Today reads), an older exam document's `planId` points at it and `planedits/<date>` puts it in force (as plan.approve does). Both writes are safe to repeat when a step retries.
import {
  centralDate,
  deriveWeakSpot,
  endedReason,
  lastDay,
  planEnded,
  isActive,
  parseExam,
  reviewNeed,
} from "../domain/index.ts";
import { docsRepo } from "../data/index.ts";
import { readJobPlan } from "./job-plans.ts";
import { examDoc } from "./goal-wire.ts";
import { weakSpotDocs } from "./weak-wire.ts";
import { putPlanInForce } from "./handlers-dates.ts";
import type { DocsD1 } from "../data/index.ts";
import type { Attempt } from "../domain/index.ts";
import type { D1Like, Plan } from "../jobs/index.ts";
import type { JobRunEnv } from "./job-run.ts";

type Row = { id: string; data: string; v: number };
type Answers = Record<string, Record<string, Record<string, unknown>>>;

const SPOT_FIELD = "weakspotId";

/** Every answer aimed at a weak spot, from the page's append-only `answers` documents. */
async function attemptsBySpot(db: D1Like): Promise<Map<string, Attempt[]>> {
  const { results } = await db
    .prepare("SELECT data FROM docs WHERE c = 'answers' AND data LIKE ?")
    .bind(`%"${SPOT_FIELD}"%`)
    .all<{ data: string }>();
  const out = new Map<string, Attempt[]>();
  for (const r of results) {
    const answers = (JSON.parse(r.data) as { answers?: Answers }).answers ?? {};
    for (const byKey of Object.values(answers))
      for (const a of Object.values(byKey)) {
        const id = a[SPOT_FIELD];
        if (
          typeof id !== "string" ||
          typeof a.correct !== "boolean" ||
          typeof a.at !== "string"
        )
          continue;
        const at: Attempt = {
          at: a.at,
          correct: a.correct,
          ...(a.matched ? { matched: true } : {}),
        };
        out.set(id, [...(out.get(id) ?? []), at]);
      }
  }
  return out;
}

/** The last day of a job's saved draft plan (Central date), or undefined when it has no draft or no tasks. */
export async function lastDraftDay(
  db: D1Like,
  jobId: string,
): Promise<string | undefined> {
  const body = await readJobPlan(db, jobId, "draft");
  if (body === undefined) return undefined;
  const tasks = (body as { tasks?: { date?: unknown }[] }).tasks;
  return lastDay(
    (tasks ?? []).flatMap((t) => (typeof t.date === "string" ? [t.date] : [])),
  );
}

export function planHome(
  db: D1Like,
  clock: () => number,
): JobRunEnv["planHome"] {
  return {
    async load(goalId) {
      const row = await examDoc(db as DocsD1, clock, goalId);
      if (!row) return undefined;
      const exam = parseExam(row.data);
      const today = centralDate(clock());
      // The weak spots are rows (§data.tables); the ones whose objective is linked to this goal are aimed at it.
      const attempts = await attemptsBySpot(db);
      const spots = (await weakSpotDocs(db as DocsD1, clock)).flatMap((r) => {
        const spot = r.data;
        if (spot.exam !== goalId) return [];
        const model = {
          kind: spot.kind,
          derived: deriveWeakSpot(spot, attempts.get(r.id) ?? [], {
            goalDate: exam.date ?? null,
            id: r.id,
          }),
        };
        return isActive(model)
          ? [{ id: r.id, title: spot.topic, need: reviewNeed(model) }]
          : [];
      });
      return { exam: { ...exam, id: goalId }, spots, today };
    },

    async apply(jobId, plan: Plan) {
      const ctx = await readJobPlan(db, jobId, "context");
      if (ctx === undefined)
        throw new Error(`job ${jobId}: no plan context saved`);
      const { goal } = ctx as {
        goal: { id: string; title: string };
      };
      const planId = `plan-${jobId}`;
      const at = clock();
      // A retried save after the plan's days passed must not put a dead plan in force.
      const last = lastDay(plan.tasks.map((t) => t.date));
      if (last !== undefined && planEnded([last], centralDate(at)))
        throw new Error(endedReason(last));
      const days = [...new Set(plan.tasks.map((t) => t.date))]
        .sort()
        .map((date) => ({
          date,
          tasks: plan.tasks
            .map((t, n) => ({ t, n }))
            .filter(({ t }) => t.date === date)
            .map(({ t, n }) => ({
              id: `${jobId}-${n + 1}`,
              text: t.title,
              kind: "study",
              minutes: t.minutes,
              ...(t.weakSpotId ? { ref: t.weakSpotId } : {}),
            })),
        }));
      const doc = {
        schema: 1,
        writer: "worker",
        at: new Date(at).toISOString(),
        source: `v5/job:${jobId}`,
        exam: goal.id,
        title: `${goal.title}: ${plan.summary}`.slice(0, 200),
        days,
      };
      // Both writes go through the docs protocol: canonical JSON and the version guard (§data.protocol).
      const docs = docsRepo(db as DocsD1, { clock });
      if (!(await docs.get("plans", planId))) {
        const made = await docs.save(
          "plans",
          planId,
          JSON.stringify(doc),
          null,
        );
        if (!made.ok)
          throw new Error(`plan ${planId} was not saved: ${made.error}`);
      }
      const row = await examDoc(db as DocsD1, clock, goal.id);
      if (!row)
        throw new Error(
          `The date ${goal.title} is gone, so the plan has nowhere to attach.`,
        );
      const e = row.data as Record<string, unknown>;
      // A goal row has no planId of its own: goalDocs (goal-wire.ts) reads it from `planedits/<goal>`, put in force below.
      if (!goal.id.startsWith("goal_") && e.planId !== planId) {
        // An exam is a Fact: its writer and source are write-once, so only planId and at change.
        const next = { ...e, planId, at: doc.at };
        const r = await docs.save(
          "exams",
          goal.id,
          JSON.stringify(next),
          row.v,
        );
        if (!r.ok)
          throw new Error(
            `The date ${goal.title} was not updated (it may have changed while the plan was saved; try again): ${r.error}`,
          );
      }
      // Approving the job is the one tap: the plan is also put in force, as the plan.approve command does.
      await putPlanInForce(
        { db: db as never, clock },
        goal.id,
        planId,
        `v5/job:${jobId}`,
      );
      return planId;
    },
  };
}
