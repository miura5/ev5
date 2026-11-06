// The two prep-plan commands that run the job (CONTRACT §job.prep-plan, §cmd.registry): "plan this date with E.V."
// starts the plan job for an exam, and "ask for changes" answers the waiting plan with Matt's note so the job's own
// revise step does the work. Spend and ceilings are the job runtime's (§model.ceilings); nothing here calls a model.
import {
  continueJob,
  d1JobStore,
  isTerminal,
  startJob,
  studyPlanJob,
  transition,
  update,
} from "../jobs/index.ts";
import type { JobDef } from "../jobs/index.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { startEnv } from "./job-routes.ts";
import { examDoc } from "./goal-wire.ts";
import { examsOfPlans } from "./plan-context.ts";

const def = studyPlanJob as JobDef;
const MAX_NOTE = 2000;
const PLAN_PREFIX = "plan-";

/** One exam keeps one plan in the making: the older drafts for it are put away and the older runs stopped. */
async function replaceOlder(x: HandlerCtx, examId: string, keep: string) {
  const store = d1JobStore(x.db as never, x.clock);
  const live = (await store.list()).filter(
    (r) => r.kind === def.kind && r.id !== keep && !isTerminal(r.state),
  );
  const exams = await examsOfPlans(
    x.db as never,
    live.map((r) => r.id),
  );
  for (const rec of live) {
    if (exams.get(rec.id) !== examId) continue;
    try {
      if (rec.state === "needs-you")
        await continueJob(
          startEnv({ DB: x.db as never, JOBS: x.jobs! }, def),
          def,
          rec.id,
          { decision: "put_away" },
        );
      else
        await update(store, rec.id, (r) =>
          transition(r, {
            to: "failed",
            at: new Date(x.clock()).toISOString(),
            reason: "Replaced by a newer plan for the same exam.",
          }),
        );
    } catch (e) {
      // A race with Matt's own tap: that plan has already moved on, which is what was wanted.
      console.warn(`older plan ${rec.id} was not replaced`, e);
    }
  }
}

export const studyPlanHandlers: Record<string, CommandHandler> = {
  "date.plan_with_ev": async (i: { id: string }, _c, x) => {
    if (!x.jobs) throw new CommandError(503, "jobs are not available here");
    const exam = await examDoc(x.db as never, x.clock, i.id);
    if (!exam) throw new CommandError(404, `no exam ${i.id}`);
    const job = await startJob(
      startEnv({ DB: x.db as never, JOBS: x.jobs }, def),
      def,
      { examId: i.id },
      "matt",
    );
    if (job.state === "failed")
      throw new CommandError(
        502,
        job.reason ?? "the plan could not be started",
      );
    await replaceOlder(x, i.id, job.id);
    return { job };
  },

  // The id is the plan's job, or the plan id `plan-<job>` the screen carries; the plan must be waiting for an answer.
  "studyplan.ask_changes": async (i: { id: string; note: string }, _c, x) => {
    if (!x.jobs) throw new CommandError(503, "jobs are not available here");
    const note = i.note.trim();
    if (!note) throw new CommandError(400, "say what to change");
    if (note.length > MAX_NOTE)
      throw new CommandError(400, `keep the note under ${MAX_NOTE} characters`);
    const store = d1JobStore(x.db as never, x.clock);
    const rec =
      (await store.get(i.id)) ??
      (i.id.startsWith(PLAN_PREFIX)
        ? await store.get(i.id.slice(PLAN_PREFIX.length))
        : undefined);
    if (!rec || rec.kind !== def.kind)
      throw new CommandError(404, `no study plan ${i.id}`);
    if (rec.state !== "needs-you")
      throw new CommandError(409, "that plan is not waiting for your answer");
    try {
      const job = await continueJob(
        startEnv({ DB: x.db as never, JOBS: x.jobs }, def),
        def,
        rec.id,
        { decision: "change", note },
      );
      return { job };
    } catch (e) {
      // The runtime's own sentence says what refused (a state race, or the Workflow could not take the answer).
      throw new CommandError(
        409,
        `that plan changed; try again (${(e as Error).message})`,
      );
    }
  },
};
