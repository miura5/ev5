// Where the study plan reads its exam and weak spots and where an approved plan lands (ev4 docs collections).
// load: `exams/<id>` plus the `weakspots` aimed at that exam, derived with their `answers` as of Central today, with
// the active ones worst first (the order is code, CONTRACT §cmd.code-first). apply: the plan becomes `plans/plan-<job>`
// (what Today reads) and the exam's `planId` points at it. Both writes are safe to repeat when a step retries.
import {
  centralDate,
  deriveWeakSpot,
  isActive,
  parseExam,
  parseWeakSpot,
  reviewNeed,
} from "../domain/index.ts";
import { docsRepo } from "../data/index.ts";
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

export function planHome(
  db: D1Like,
  clock: () => number,
): JobRunEnv["planHome"] {
  return {
    async load(examId) {
      const row = await db
        .prepare("SELECT id, data, v FROM docs WHERE c = 'exams' AND id = ?")
        .bind(examId)
        .first<Row>();
      if (!row) return undefined;
      const exam = parseExam(JSON.parse(row.data));
      const today = centralDate(clock());
      const { results } = await db
        .prepare("SELECT id, data FROM docs WHERE c = 'weakspots'")
        .all<Row>();
      const attempts = await attemptsBySpot(db);
      const spots = results.flatMap((r) => {
        let spot;
        try {
          spot = parseWeakSpot(JSON.parse(r.data));
        } catch {
          return []; // one malformed document must not stop a plan
        }
        if (spot.exam !== examId) return [];
        const model = {
          kind: spot.kind,
          derived: deriveWeakSpot(spot, attempts.get(r.id) ?? [], {
            examDate: exam.date ?? null,
            id: r.id,
          }),
        };
        return isActive(model)
          ? [{ id: r.id, title: spot.topic, need: reviewNeed(model) }]
          : [];
      });
      return { exam: { ...exam, id: examId }, spots, today };
    },

    async apply(jobId, plan: Plan) {
      const ctx = await db
        .prepare(
          "SELECT body FROM job_plans WHERE job_id = ? AND kind = 'context'",
        )
        .bind(jobId)
        .first<{ body: string }>();
      if (!ctx) throw new Error(`job ${jobId}: no plan context saved`);
      const { exam } = JSON.parse(ctx.body) as {
        exam: { id: string; title: string };
      };
      const planId = `plan-${jobId}`;
      const at = clock();
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
        exam: exam.id,
        title: `${exam.title}: ${plan.summary}`.slice(0, 200),
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
      const row = await docs.get("exams", exam.id);
      if (!row)
        throw new Error(
          `exam ${exam.id} is gone, so the plan has nowhere to attach.`,
        );
      const e = row.data as Record<string, unknown>;
      if (e.planId !== planId) {
        // An exam is a Fact: its writer and source are write-once, so only planId and at change.
        const next = { ...e, planId, at: doc.at };
        const r = await docs.save(
          "exams",
          exam.id,
          JSON.stringify(next),
          row.v,
        );
        if (!r.ok)
          throw new Error(
            `exam ${exam.id} was not updated (it may have changed while the plan was saved; try again): ${r.error}`,
          );
      }
      return planId;
    },
  };
}
