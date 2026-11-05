// /api/v1 job routes (CONTRACT §sec.auth, §job.executors): start, continue and read the job kinds, and the ceilings.
// Auth is applied by index.ts before these run. Callers reach /jobs/ by scope; only the app token may reach /ceilings.
import { Hono } from "hono";
import {
  acknowledgeSpendAlert,
  cloudflareAdapter,
  d1JobStore,
  continueJob,
  jobStatus,
  parsePublicInput,
  practiceSet,
  startJob,
  studyPlanJob,
  sweepStale,
  workflowExecutor,
} from "../jobs/index.ts";
import { tablesRepo } from "../data/index.ts";
import type { DocsD1 } from "../data/index.ts";
import type { D1Like, JobDef, StartEnv } from "../jobs/index.ts";
import { loadCeilingConfig, saveCeilingConfig } from "./job-run.ts";
import type { AuthVars } from "./auth.ts";
import { gatherExcerpts } from "./excerpts.ts";
import { endedSessionsToday, finishedJobsToday } from "./jobs-done.ts";
import { courseOfSet } from "./frame-prompt.ts";

export interface JobRoutesEnv {
  DB: D1Like;
  JOBS: { create(o: { id: string; params: unknown }): Promise<unknown> };
}

/** The job kinds this Worker starts; each URL slug is its kind with dashes (practice_set is /jobs/practice-set). */
const JOB_DEFS: readonly JobDef[] = [
  practiceSet as JobDef,
  studyPlanJob as JobDef,
];
export const DEFS = new Map(JOB_DEFS.map((d) => [d.kind, d]));
const KINDS: Record<string, JobDef> = Object.fromEntries(
  JOB_DEFS.map((d) => [d.kind.replace(/_/g, "-"), d]),
);

export function startEnv(env: JobRoutesEnv, def: JobDef): StartEnv {
  return {
    store: d1JobStore(env.DB, () => Date.now()),
    executors: {
      workflow: workflowExecutor(
        cloudflareAdapter(env.JOBS as Parameters<typeof cloudflareAdapter>[0]),
        def.kind,
      ),
    },
    now: () => new Date().toISOString(),
    newId: () => crypto.randomUUID(),
  };
}

/** The scope a practice set was asked for, in job_plans under kind `scope`. */
export async function saveScope(
  db: D1Like,
  jobId: string,
  scope: unknown,
  at: number,
) {
  await tablesRepo(db as DocsD1, { clock: () => at }).jobPlans.put(
    jobId,
    "scope",
    scope,
  );
}

export async function withGathered(
  db: D1Like,
  input: { objectives: string[]; targetId?: string },
) {
  const course = input.targetId ? await courseOfSet(db, input.targetId) : null;
  return {
    ...input,
    ...(course ? { course } : {}),
    excerpts: await gatherExcerpts(db, input.objectives),
  };
}

const body = async (req: Request): Promise<Record<string, unknown>> => {
  try {
    const v: unknown = await req.json();
    return typeof v === "object" && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

export const jobRoutes = new Hono<{
  Bindings: JobRoutesEnv;
  Variables: AuthVars;
}>();

jobRoutes.post("/jobs/:slug", async (c) => {
  const def = KINDS[c.req.param("slug")];
  if (!def) return c.json({ error: "not found" }, 404);
  // The app token is Matt's taps; the schedule token starts only what a schedule may (neither job kind).
  const by = c.get("caller") === "app" ? "matt" : "schedule";
  if (!def.startedBy.includes(by))
    return c.json({ error: `${def.title} cannot be started by ${by}` }, 403);
  const { input: asked } = await body(c.req.raw);
  // The caller names a scope (objectives); the server finds the passages itself and drops any it was sent.
  let input = asked;
  try {
    if (def === (practiceSet as JobDef))
      input = await withGathered(c.env.DB, parsePublicInput(asked));
    else def.input(asked);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  const rec = await startJob(startEnv(c.env, def), def, input, by);
  // Kept so "retry shorter" can start the same scope again (without the gathered passages).
  if (def === (practiceSet as JobDef))
    await saveScope(c.env.DB, rec.id, asked, Date.now());
  return c.json({ job: rec }, rec.state === "failed" ? 502 : 202);
});

jobRoutes.post("/jobs/:id/continue", async (c) => {
  const rec = await d1JobStore(c.env.DB, () => Date.now()).get(
    c.req.param("id"),
  );
  const def = rec && DEFS.get(rec.kind);
  if (!rec || !def) return c.json({ error: "not found" }, 404);
  if (rec.state !== "needs-you")
    return c.json({ error: "job is not waiting for you" }, 409);
  const { answer } = await body(c.req.raw);
  const next = await continueJob(startEnv(c.env, def), def, rec.id, answer);
  return c.json({ job: next }, 202);
});

// Matt's acknowledge on the monthly spend alert closes it (done); only the app token, only that kind.
jobRoutes.post("/jobs/:id/dismiss", async (c) => {
  if (c.get("caller") !== "app") return c.json({ error: "forbidden" }, 403);
  const store = d1JobStore(c.env.DB, () => Date.now());
  const rec = await store.get(c.req.param("id"));
  if (!rec) return c.json({ error: "not found" }, 404);
  try {
    return c.json({
      job: await acknowledgeSpendAlert(store, rec.id, new Date()),
    });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 409);
  }
});

jobRoutes.get("/jobs/:id", async (c) => {
  try {
    const [status] = await jobStatus(
      d1JobStore(c.env.DB, () => Date.now()),
      DEFS,
      c.req.param("id"),
    );
    return c.json({ status });
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

/** The exam each live study plan was made for, from the context saved at its gather step. */
export async function examsOfPlans(
  db: D1Like,
  ids: string[],
): Promise<Map<string, string>> {
  const exam = new Map<string, string>();
  if (!ids.length) return exam;
  const { results } = await db
    .prepare(
      `SELECT job_id, body FROM job_plans WHERE kind = 'context' AND job_id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(...ids)
    .all<{ job_id: string; body: string }>();
  for (const r of results)
    try {
      const id = (JSON.parse(r.body) as { exam?: { id?: unknown } }).exam?.id;
      if (typeof id === "string") exam.set(r.job_id, id);
    } catch {
      // a context that does not read is left without an exam
    }
  return exam;
}

/** The proposed sessions of each waiting study plan, from the draft saved at its draft step. */
export async function draftTasksOfPlans(
  db: D1Like,
  ids: string[],
): Promise<Map<string, { date: string; title: string; minutes: number }[]>> {
  const out = new Map<
    string,
    { date: string; title: string; minutes: number }[]
  >();
  if (!ids.length) return out;
  const { results } = await db
    .prepare(
      `SELECT job_id, body FROM job_plans WHERE kind = 'draft' AND job_id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(...ids)
    .all<{ job_id: string; body: string }>();
  for (const r of results)
    try {
      const tasks = (JSON.parse(r.body) as { tasks?: unknown }).tasks;
      if (!Array.isArray(tasks)) continue;
      out.set(
        r.job_id,
        tasks.flatMap(
          (t: { date?: unknown; title?: unknown; minutes?: unknown }) =>
            typeof t?.date === "string" &&
            typeof t.title === "string" &&
            typeof t.minutes === "number"
              ? [{ date: t.date, title: t.title, minutes: t.minutes }]
              : [],
        ),
      );
    } catch {
      // a draft that does not read is left without sessions
    }
  return out;
}

/** A waiting study plan names its exam and carries its proposed sessions, so Library can match and show it. */
async function withExams<T extends { id: string; kind: string; state: string }>(
  db: D1Like,
  jobs: T[],
): Promise<
  (T & {
    examId?: string;
    tasks?: { date: string; title: string; minutes: number }[];
  })[]
> {
  const waiting = jobs.filter(
    (j) => j.kind === studyPlanJob.kind && j.state === "needs-you",
  );
  if (!waiting.length) return jobs;
  const ids = waiting.map((j) => j.id);
  const exam = await examsOfPlans(db, ids);
  const tasks = await draftTasksOfPlans(db, ids);
  return jobs.map((j) => ({
    ...j,
    ...(exam.has(j.id) ? { examId: exam.get(j.id) } : {}),
    ...(tasks.has(j.id) ? { tasks: tasks.get(j.id) } : {}),
  }));
}

// Only live jobs: one past its deadline is failed first, so a lost runner never shows as running.
jobRoutes.get("/jobs", async (c) => {
  const store = d1JobStore(c.env.DB, () => Date.now());
  // ?finished=today is Activity's "Done today": what finished since midnight Central (server/jobs-done.ts).
  if (c.req.query("finished") === "today") {
    const now = Date.now();
    return c.json({
      jobs: [
        ...(await finishedJobsToday(store, DEFS, now)),
        ...(await endedSessionsToday(c.env.DB, now)),
      ],
    });
  }
  try {
    await sweepStale(store, new Date().toISOString());
  } catch (e) {
    console.error("sweep before listing jobs failed", e);
  }
  return c.json({
    jobs: await withExams(c.env.DB, await jobStatus(store, DEFS)),
  });
});

// Only the app token changes ceilings (§sec.auth); the scope table already keeps the others out, this is the second lock.
jobRoutes.get("/ceilings", async (c) =>
  c.get("caller") === "app"
    ? c.json({ ceilings: await loadCeilingConfig(c.env.DB) })
    : c.json({ error: "forbidden" }, 403),
);

jobRoutes.put("/ceilings", async (c) => {
  if (c.get("caller") !== "app") return c.json({ error: "forbidden" }, 403);
  const b = await body(c.req.raw);
  const keys = ["hourly", "daily", "monthly", "perJob"] as const;
  const cur = await loadCeilingConfig(c.env.DB);
  const next = { ...cur };
  for (const k of keys) {
    if (b[k] === undefined) continue;
    const v = b[k];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0)
      return c.json(
        { error: `${k} must be whole micro-dollars, 0 or more` },
        400,
      );
    next[k] = v;
  }
  await saveCeilingConfig(c.env.DB, next, Date.now());
  return c.json({ ceilings: next });
});
