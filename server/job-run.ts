// What a Workflow instance does (CONTRACT §job.steps): pick the job kind's definition and handlers, then runJob.
// Kept apart from the WorkflowEntrypoint class so tests run it in Node with the fake Workflows and no Cloudflare runtime.
import {
  askChanges,
  d1CeilingStore,
  d1JobStore,
  d1PlanStore,
  jobCeilings,
  practiceSet,
  practiceSetHandlers,
  runJob,
  saveOutput,
  studyPlanHandlers,
  studyPlanJob,
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
  /** Each kind's system prompt (prompt.md), loaded by the Worker with Vite `?raw`. */
  prompts: { practice_set: string; study_plan: string; study_plan_changes: string };
  /** Where the study plan reads its exam and approves its tasks (ev4 docs; server/plan-home.ts). */
  planHome: {
    load: PlanStore["load"];
    apply: (jobId: string, plan: Plan) => Promise<string>;
  };
  now?: () => Date;
  newId?: () => string;
};

/**
 * Ceiling amounts live in D1 settings (micro-dollars, 1,000,000 = $1). An unset key uses DEFAULT_CEILINGS, so jobs
 * run before Matt has set anything; a stored value (even 0, which stops every call) always wins.
 * The defaults are a builder's guesses (D-460), chosen to be low: one study plan (60 cents) or practice
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
    .prepare("SELECT key, value FROM claude_settings")
    .all<{ key: string; value: number }>();
  const by = new Map(results.map((r) => [r.key, r.value]));
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
  for (const [name, key] of Object.entries(CEILING_KEYS))
    await db
      .prepare(
        "INSERT INTO claude_settings (key, value, at) VALUES (?, ?, ?) " +
          "ON CONFLICT (key) DO UPDATE SET value = excluded.value, at = excluded.at",
      )
      .bind(key, c[name as keyof CeilingConfig], at)
      .run();
}

/** Practice set content between steps: the result and any failure, in job_plans (keyed by job id). */
export function d1PracticeStore(
  db: D1Like,
  clock: () => number,
): PracticeStore {
  const put = async (jobId: string, kind: string, body: unknown) => {
    await db
      .prepare(
        "INSERT INTO job_plans (job_id, kind, body, at) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (job_id, kind) DO UPDATE SET body = excluded.body, at = excluded.at",
      )
      .bind(jobId, kind, JSON.stringify(body), clock())
      .run();
    return `${jobId}:${kind}`;
  };
  const get = async <T>(jobId: string, kind: string) => {
    const r = await db
      .prepare("SELECT body FROM job_plans WHERE job_id = ? AND kind = ?")
      .bind(jobId, kind)
      .first<{ body: string }>();
    return r ? (JSON.parse(r.body) as T) : undefined;
  };
  return {
    put: (j, r) => put(j, "result", r),
    get: async (j) => {
      const r = await get<Parameters<PracticeStore["put"]>[1]>(j, "result");
      if (!r) throw new Error(`job ${j}: no result saved`);
      return r;
    },
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
    [studyPlanJob.kind]: {
      def: studyPlanJob as JobDef,
      handlers: studyPlanHandlers({
        store: d1PlanStore(env.db, clock, env.planHome),
        call: env.call,
        system: env.prompts.study_plan,
        changesSystem: env.prompts.study_plan_changes,
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
  const ceilings = jobCeilings(
    ceilingStore ?? d1CeilingStore(env.db),
    () => loadCeilingConfig(env.db),
    now,
    env.newId ?? (() => crypto.randomUUID()),
  );
  await runJob(
    {
      store: d1JobStore(env.db, () => now().getTime()),
      ceilings,
      now: () => now().toISOString(),
    },
    step,
    kind.def,
    kind.handlers,
    p,
  );
}
