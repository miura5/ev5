// Job commands Matt taps in Activity (CONTRACT §cmd.registry, §job.record): stop, dismiss, retry shorter. Each moves the
// one job record through the runtime's own transition, so an illegal move is refused the same way everywhere.
import {
  acknowledgeSpendAlert,
  d1JobStore,
  isTerminal,
  parsePublicInput,
  practiceSet,
  startJob,
  sweepStale,
  transition,
  update,
} from "../jobs/index.ts";
import type { JobDef } from "../jobs/index.ts";
import { readJobPlan } from "./job-plans.ts";
import { CommandError } from "./handlers-core.ts";
import type { CommandHandler, HandlerCtx } from "./handlers-core.ts";
import { saveScope, startEnv, withGathered } from "./job-routes.ts";

type Ref = { id: string };

const storeOf = (x: HandlerCtx) => d1JobStore(x.db as never, x.clock, x.onBad);
const iso = (x: HandlerCtx) => new Date(x.clock()).toISOString();

async function need(x: HandlerCtx, id: string) {
  const rec = await storeOf(x).get(id);
  if (!rec) throw new CommandError(404, `no job ${id}`);
  return rec;
}

export const jobHandlers: Record<string, CommandHandler> = {
  // The 15-minute cron: fails queued or running jobs whose runner was lost; a second run finds nothing to change.
  job_sweep: async (_i, _c, x) => ({
    failed: await sweepStale(storeOf(x), iso(x)),
  }),
  // A job that is still going ends as failed with the reason "Stopped"; a finished one cannot be stopped.
  "job.stop": async (i: Ref, _c, x) => {
    const rec = await need(x, i.id);
    if (isTerminal(rec.state))
      throw new CommandError(409, `${rec.title} has already finished`);
    const job = await update(storeOf(x), rec.id, (r) =>
      transition(r, {
        to: "failed",
        at: iso(x),
        reason: "Stopped by you.",
      }),
    ).catch(() => {
      throw new CommandError(409, "that job changed; try again");
    });
    return { job };
  },
  // The spend alert closes (done); a job that already finished has nothing left to close; one still going is stopped instead.
  "job.dismiss": async (i: Ref, _c, x) => {
    const rec = await need(x, i.id);
    if (isTerminal(rec.state)) return { job: rec };
    if (rec.state !== "needs-you")
      throw new CommandError(409, `${rec.title} is still running; stop it`);
    try {
      return {
        job: await acknowledgeSpendAlert(
          storeOf(x),
          rec.id,
          new Date(x.clock()),
        ),
      };
    } catch {
      throw new CommandError(409, `${rec.title} is waiting for your answer`);
    }
  },
  // A failed practice set starts again from the scope it was asked for, with half the questions (at least one).
  "job.retry_shorter": async (i: Ref, _c, x) => {
    const rec = await need(x, i.id);
    if (rec.state !== "failed")
      throw new CommandError(409, `${rec.title} has not failed`);
    if (rec.kind !== practiceSet.kind)
      throw new CommandError(409, `${rec.title} has no shorter version`);
    if (!x.jobs) throw new CommandError(503, "jobs are not available here");
    let row;
    try {
      row = await readJobPlan(x.db as never, rec.id, "scope");
    } catch {
      throw new CommandError(409, "the original request cannot be read");
    }
    if (row === undefined)
      throw new CommandError(409, "the original request was not kept");
    let scope;
    try {
      scope = parsePublicInput(row);
    } catch {
      throw new CommandError(409, "the original request cannot be read");
    }
    const count = Math.max(1, Math.floor(scope.count / 2));
    if (count === scope.count)
      throw new CommandError(409, "it is already as short as it gets");
    const shorter = { ...scope, count };
    const input = await withGathered(x.db as never, shorter);
    const env = startEnv(
      { DB: x.db as never, JOBS: x.jobs },
      practiceSet as JobDef,
    );
    const job = await startJob(env, practiceSet as JobDef, input, "matt");
    await saveScope(x.db as never, job.id, shorter, x.clock());
    return { job };
  },
};
