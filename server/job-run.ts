// What a Workflow instance does (CONTRACT §job.steps): pick the job kind's definition and handlers, then runJob.
// Kept apart from the WorkflowEntrypoint class so tests run it in Node with the fake Workflows and no Cloudflare runtime.
import { parseSettingRow } from "../domain/index.ts";
import { readJobPlan } from "./job-plans.ts";
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import {
  askChanges,
  d1CeilingStore,
  d1JobStore,
  d1PlanStore,
  jobCeilings,
  spendAlertWriter,
  practiceSet,
  practiceSetHandlers,
  runJob,
  saveOutput,
  prepPlanHandlers,
  prepPlanJob,
} from "../jobs/index.ts";
import type {
  CeilingConfig,
  CeilingStore,
  D1Like,
  InstanceParams,
  JobDef,
  ModelCall,
  Plan,
  PlanStore,
  PracticeStore,
  StepHandlers,
  StepRunner,
} from "../jobs/index.ts";

export type JobRunEnv = {
  db: D1Like;
  call: ModelCall;
  /** Each kind's system prompt (prompt.md), loaded by the Worker as a wrangler Text module. */
  prompts: {
    practice_set: string;
    prep_plan: string;
    prep_plan_changes: string;
  };
  /** Where the prep plan reads its exam and weak spots (server/plan-home.ts). */
  planHome: {
    load: PlanStore["load"];
  };
  now?: () => Date;
  newId?: () => string;
};

/**
 * Ceiling amounts live in D1 settings (micro-dollars, 1,000,000 = $1). An unset key uses DEFAULT_CEILINGS, so jobs
 * run before Matt has set anything; a stored value (even 0, which stops every call) always wins.
 * The defaults are a builder's guesses, chosen to be low: one prep plan (60 cents) or practice
 * set (50 cents) fits the per-job cap, a few fit the day.
 */
export const DEFAULT_CEILINGS: CeilingConfig = {
  hourly: 2_000_000,
  daily: 5_000_000,
  monthly: 40_000_000,
  perJob: 1_000_000,
};
const CEILING_KEYS = {
  hourly: "ceiling_hourly",
  daily: "ceiling_daily",
  monthly: "ceiling_monthly",
  perJob: "ceiling_per_job",
};
export async function loadCeilingConfig(db: D1Like): Promise<CeilingConfig> {
  const { results } = await db
    .prepare("SELECT key, value, at, v FROM settings")
    .all<unknown>();
  const by = new Map(
    results.map((r) => {
      const s = parseSettingRow(r);
      return [s.key, s.value] as const;
    }),
  );
  const n = (k: keyof CeilingConfig) =>
    by.get(CEILING_KEYS[k]) ?? DEFAULT_CEILINGS[k];
  return {
    hourly: n("hourly"),
    daily: n("daily"),
    monthly: n("monthly"),
    perJob: n("perJob"),
  };
}

export async function saveCeilingConfig(
  db: D1Like,
  c: CeilingConfig,
  at: number,
): Promise<void> {
  await tablesRepo(db as DocsD1, { clock: () => at }).settings.putNumbers(
    Object.fromEntries(
      Object.entries(CEILING_KEYS).map(([name, key]) => [
        key,
        c[name as keyof CeilingConfig],
      ]),
    ),
  );
}

/** Practice set content between steps: the result and any failure, in job_plans (keyed by job id). */
export function d1PracticeStore(
  db: D1Like,
  clock: () => number,
): PracticeStore {
  const put = async (jobId: string, kind: string, body: unknown) => {
    await tablesRepo(db as DocsD1, { clock }).jobPlans.put(jobId, kind, body);
    return `${jobId}:${kind}`;
  };
  const get = async <T>(jobId: string, kind: string) => {
    return (await readJobPlan(db, jobId, kind)) as T | undefined;
  };
  return {
    put: (j, r) => put(j, "result", r),
    get: async (j) => {
      const r = await get<Parameters<PracticeStore["put"]>[1]>(j, "result");
      if (!r) throw new Error(`job ${j}: no result saved`);
      return r;
    },
    find: (j) => get<Parameters<PracticeStore["put"]>[1]>(j, "result"),
    putFailure: async (j, reason) => void (await put(j, "failure", reason)),
    getFailure: (j) => get<string>(j, "failure"),
    save: async (jobId, targetId, r) =>
      void (await saveOutput(db, clock, {
        jobId,
        targetId,
        items: r.items,
        drafts: r.drafts,
      })),
  };
}

/** The job kinds this Worker runs. */
export function jobKinds(
  env: JobRunEnv,
): Record<string, { def: JobDef; handlers: StepHandlers }> {
  const clock = () => (env.now ?? (() => new Date()))().getTime();
  return {
    [practiceSet.kind]: {
      def: practiceSet as JobDef,
      handlers: practiceSetHandlers({
        store: d1PracticeStore(env.db, clock),
        call: env.call,
        system: env.prompts.practice_set,
      }),
    },
    [prepPlanJob.kind]: {
      def: prepPlanJob as JobDef,
      handlers: prepPlanHandlers({
        store: d1PlanStore(env.db, clock, env.planHome),
        call: env.call,
        system: env.prompts.prep_plan,
        changesSystem: env.prompts.prep_plan_changes,
        askChanges,
      }),
    },
  };
}

export async function runWorkflow(
  env: JobRunEnv,
  step: StepRunner,
  p: InstanceParams,
  ceilingStore?: CeilingStore,
): Promise<void> {
  const now = env.now ?? (() => new Date());
  const kind = jobKinds(env)[p.kind];
  if (!kind) throw new Error(`This Worker does not run ${p.kind} jobs.`);
  const jobStore = d1JobStore(env.db, () => now().getTime());
  const ceilings = jobCeilings(
    ceilingStore ?? d1CeilingStore(env.db),
    () => loadCeilingConfig(env.db),
    now,
    env.newId ?? (() => crypto.randomUUID()),
    spendAlertWriter(jobStore),
  );
  await runJob(
    {
      store: jobStore,
      ceilings,
      now: () => now().toISOString(),
    },
    step,
    kind.def,
    kind.handlers,
    p,
  );
}
