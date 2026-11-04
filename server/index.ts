import { Hono } from "hono";
import { bearerAuth } from "./auth.ts";
import type { AuthEnv, AuthVars } from "./auth.ts";
import { jobRoutes } from "./job-routes.ts";
import { docRoutes } from "./doc-routes.ts";
import { collectionRoutes } from "./collection-routes.ts";
import { commandRoutes } from "./command-routes.ts";
import { askRoutes } from "./ask-chat.ts";
import { imageRoutes } from "./image-routes.ts";
import type { R2Like } from "./image-routes.ts";
import { isEv4Route } from "./ev4-routes.ts";
import type { D1Like } from "../jobs/index.ts";

export interface Env extends AuthEnv {
  DB: D1Like;
  /** The job Workflow (wrangler `workflows`); startJob reaches it through cloudflareAdapter. */
  JOBS: { create(o: { id: string; params: unknown }): Promise<unknown> };
  /** Worker secret, set by Matt (AGENTS §6); the job steps stop with a plain reason when it is missing. */
  ANTHROPIC_API_KEY?: string;
  /** Tests hand in a fake model call for Ask E.V.; production builds one from the key. */
  ASK_CALL?: import("../jobs/index.ts").ModelCall;
  /** The environment's R2 bucket for note pictures (wrangler `r2_buckets`), keys under note-images/. */
  IMAGES?: R2Like;
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Set at deploy (`--var COMMIT:<sha>`). */
  COMMIT?: string;
  /** "staging" on ev5-staging. */
  ENV_NAME?: string;
}

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.get("/api/health", async (c) => {
  let docs: number | null = null;
  let db = "ok";
  try {
    const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM docs").first<{
      n: number;
    }>();
    docs = row?.n ?? 0;
  } catch {
    db = "error";
  }
  return c.json(
    {
      ok: db === "ok",
      app: "ev5",
      env: c.env.ENV_NAME ?? "unknown",
      commit: c.env.COMMIT ?? "unknown",
      db,
      docs,
    },
    db === "ok" ? 200 : 503,
  );
});

// v5 routes live under /api/v1 behind a scoped bearer token; commands plug in here as handlers.
app.use("/api/v1/*", bearerAuth());
app.get("/api/v1/whoami", (c) => c.json({ caller: c.get("caller") }));

app.route("/api/v1", jobRoutes);
app.route("/api/v1", docRoutes);
app.route("/api/v1", collectionRoutes);
app.route("/api/v1", commandRoutes);
app.route("/api/v1", askRoutes);
app.route("/api/v1", imageRoutes);

app.all("/api/*", (c) =>
  isEv4Route(c.req.path)
    ? c.json({ error: "gone" }, 410)
    : c.json({ error: "not found" }, 404),
);

// Everything else is the built app (wrangler `assets`).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
