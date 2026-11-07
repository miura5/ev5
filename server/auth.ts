// Bearer tokens per caller (§sec.auth): scoped to route prefixes, compared in constant time, wrong attempts rate-limited.
// Token values come only from env bindings (§hard.no-secrets-in-files); an unset binding means that caller is off.
import type { MiddlewareHandler } from "hono";

export type Caller = "app" | "schedule" | "executor";

/** Route prefixes each caller may reach. Only the app token changes ceilings (§sec.auth), so it alone may reach /api/v1/ceilings. */
export const SCOPES: Record<Caller, readonly string[]> = {
  app: ["/api/v1/"],
  schedule: [
    "/api/v1/jobs",
    "/api/v1/jobs/",
    "/api/v1/commands/",
    "/api/v1/whoami",
  ],
  executor: ["/api/v1/executor/", "/api/v1/commands/", "/api/v1/whoami"],
};

export interface AuthEnv {
  TOKEN_APP?: string;
  TOKEN_SCHEDULE?: string;
  TOKEN_EXECUTOR?: string;
}

const BINDING: Record<Caller, keyof AuthEnv> = {
  app: "TOKEN_APP",
  schedule: "TOKEN_SCHEDULE",
  executor: "TOKEN_EXECUTOR",
};

const enc = new TextEncoder();
async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** Constant-time equality: both sides are hashed to the same length, then every byte is compared. */
export async function tokenMatches(
  given: string,
  expected: string,
): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

export function inScope(caller: Caller, path: string): boolean {
  return SCOPES[caller].some((p) =>
    p.endsWith("/") ? path.startsWith(p) : path === p,
  );
}

/** Fixed-window limiter for wrong attempts, per key (the client address). Per isolate: a soft brake, not a quota. */
export function createLimiter(
  max: number,
  windowMs: number,
  now: () => number = Date.now,
) {
  const seen = new Map<string, { n: number; reset: number }>();
  return {
    blocked(key: string): boolean {
      const e = seen.get(key);
      return e !== undefined && e.reset > now() && e.n >= max;
    },
    fail(key: string): void {
      const t = now();
      const e = seen.get(key);
      if (!e || e.reset <= t) {
        if (seen.size > 1000)
          for (const [k, v] of seen) if (v.reset <= t) seen.delete(k);
        seen.set(key, { n: 1, reset: t + windowMs });
      } else e.n++;
    },
  };
}

export interface AuthVars {
  caller: Caller;
  /** Set first on every request so a log line and the answer can name the same id. */
  requestId: string;
}

/** Middleware: 429 when the client has too many wrong attempts, 401 for a missing or wrong token, 403 outside scope. */
export function bearerAuth(
  limiter = createLimiter(10, 60_000),
): MiddlewareHandler<{ Bindings: AuthEnv; Variables: AuthVars }> {
  return async (c, next) => {
    const key = c.req.header("cf-connecting-ip") ?? "unknown";
    if (limiter.blocked(key))
      return c.json({ error: "too many attempts" }, 429, {
        "retry-after": "60",
      });
    const m = /^Bearer (.+)$/.exec(c.req.header("authorization") ?? "");
    let caller: Caller | null = null;
    for (const name of Object.keys(BINDING) as Caller[]) {
      const expected = c.env[BINDING[name]];
      // Check every configured token (no early exit between callers' comparisons).
      if (m && expected && (await tokenMatches(m[1] as string, expected)))
        caller = name;
    }
    if (!caller) {
      limiter.fail(key);
      return c.json({ error: "unauthorized" }, 401, {
        "www-authenticate": "Bearer",
      });
    }
    if (!inScope(caller, c.req.path))
      return c.json({ error: "forbidden" }, 403);
    c.set("caller", caller);
    await next();
  };
}
