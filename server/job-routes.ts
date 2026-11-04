// /api/v1 job routes (CONTRACT §sec.auth, §job.executors): start, continue and read the job kinds, and the ceilings.
// Auth is applied by index.ts before these run. Callers reach /jobs/ by scope; only the app token may reach /ceilings.
import { Hono } from "hono";
import {
  acknowledgeSpendAlert,
  cloudflareAdapter,
  d1JobStore,
  continueJob,
  jobStatus,
  practiceSet,
  startJob,
  studyPlanJob,
  workflowExecutor,
} from "../jobs/index.ts";
import type { D1Like, JobDef, StartEnv } from "../jobs/index.ts";
import { loadCeilingConfig, saveCeilingConfig } from "./job-run.ts";
import type { AuthVars } from "./auth.ts";

export interface JobRoutesEnv {
  DB: D1Like;
  JOBS: { create(o: { id: string; params: unknown }): Promise<unknown> };
}

/** The job kinds this Worker starts; each URL slug is its kind with dashes (practice_set is /jobs/practice-set). */
const JOB_DEFS: readonly JobDef[] = [
  practiceSet as JobDef,
  studyPlanJob as JobDef,
];
const DEFS = new Map(JOB_DEFS.map((d) => [d.kind, d]));
const KINDS: Record<string, JobDef> = Object.fromEntries(
  JOB_DEFS.map((d) => [d.kind.replace(/_/g, "-"), d]),
);

function startEnv(env: JobRoutesEnv, def: JobDef): StartEnv {
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
  const { input } = await body(c.req.raw);
  try {
    def.input(input);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  const rec = await startJob(startEnv(c.env, def), def, input, by);
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

jobRoutes.get("/jobs", async (c) =>
  c.json({
    jobs: await jobStatus(
      d1JobStore(c.env.DB, () => Date.now()),
      DEFS,
    ),
  }),
);

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
