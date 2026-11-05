// Thin adapters from the job runtime's store interfaces onto data/'s repositories (§data.gate): jobs/ holds no SQL.
// The repositories own the statements, the Worker clock for `at`, the version pin and the atomic batches.
import { tablesRepo, type DocsD1 } from "../../data/index.ts";
import type { CeilingStore } from "./ceilings.ts";
import type { JobStore } from "./record.ts";
import type { Plan, PlanContext, PlanStore } from "../study-plan/job.ts";
import type { DraftRow, PracticeItem } from "../practice-set/job.ts";

/** The slice of D1 the stores use; the data folder defines it. */
export type D1Like = DocsD1;
export type D1Statement = ReturnType<D1Like["prepare"]>;

type Clock = () => number;

export function d1JobStore(db: D1Like, clock: Clock): JobStore {
  return tablesRepo(db, { clock }).jobRecords;
}

export function d1CeilingStore(db: D1Like): CeilingStore {
  // The ceiling statements take no `at`; the clock is not read.
  const { used, findOpen, usageSeen, reserve, settle, release } = tablesRepo(
    db,
    { clock: Date.now },
  ).ceilings;
  return { used, findOpen, usageSeen, reserve, settle, release };
}

/** The study plan's content in `job_plans`, keyed by job id so a retried step writes the same row. */
export function d1PlanStore(
  db: D1Like,
  clock: Clock,
  home: {
    /** Reads the exam and weak spots (ev4 docs, Central date) and puts an approved plan's tasks on Today. */
    load: PlanStore["load"];
    apply: (jobId: string, plan: Plan) => Promise<string>;
  },
): PlanStore {
  const { jobPlans } = tablesRepo(db, { clock });
  const put = async (jobId: string, kind: string, body: unknown) => {
    await jobPlans.put(jobId, kind, body);
    return `${jobId}:${kind}`;
  };
  const get = async <T>(jobId: string, kind: string): Promise<T | undefined> =>
    (await jobPlans.get(jobId, kind)) as T | undefined;
  const need = async <T>(jobId: string, kind: string) => {
    const v = await get<T>(jobId, kind);
    if (v === undefined) throw new Error(`job ${jobId}: no ${kind} saved`);
    return v;
  };
  return {
    load: home.load,
    putContext: (j, ctx: PlanContext) => put(j, "context", ctx),
    getContext: (j) => need<PlanContext>(j, "context"),
    putDraft: (j, plan) => put(j, "draft", plan),
    getDraft: (j) => need<Plan>(j, "draft"),
    putFailure: async (j, reason) => void (await put(j, "failure", reason)),
    getFailure: (j) => get<string>(j, "failure"),
    async approve(jobId, plan) {
      const id = await home.apply(jobId, plan);
      await put(jobId, "status", "approved");
      return id;
    },
    async putAway(jobId) {
      return put(jobId, "status", "put away"); // the draft row stays
    },
  };
}

/**
 * The save step: sourced items become set items and unsourced (or "Write with E.V.") items become pending drafts,
 * in ONE batch, so nothing half-lands. A retried step is safe (the repository ignores a repeat).
 */
export async function saveOutput(
  db: D1Like,
  clock: Clock,
  a: {
    jobId: string;
    targetId: string;
    items: PracticeItem[];
    drafts: DraftRow[];
  },
): Promise<{ itemIds: string[]; draftIds: string[] }> {
  return tablesRepo(db, { clock }).jobOutput.save(a);
}
