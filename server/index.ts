import { Hono } from "hono";
import { bearerAuth } from "./auth.ts";
import type { AuthEnv, AuthVars } from "./auth.ts";
import { isEv4Route } from "./ev4-routes.ts";

/** The few D1 calls the Worker makes; the full type comes with Cloudflare's types when more is needed. */
interface D1Like {
  prepare(sql: string): { first<T>(): Promise<T | null> };
}

export interface Env extends AuthEnv {
  DB: D1Like;
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

app.all("/api/*", (c) =>
  isEv4Route(c.req.path)
    ? c.json({ error: "gone" }, 410)
    : c.json({ error: "not found" }, 404),
);

// Everything else is the built app (wrangler `assets`).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
