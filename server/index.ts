import { Hono } from 'hono';

/** The few D1 calls the Worker makes; the full type comes with Cloudflare's types when more is needed. */
interface D1Like {
  prepare(sql: string): { first<T>(): Promise<T | null> };
}

export interface Env {
  DB: D1Like;
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Set at deploy (`--var COMMIT:<sha>`). */
  COMMIT?: string;
  /** "staging" on ev5-staging. */
  ENV_NAME?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', async (c) => {
  let docs: number | null = null;
  let db = 'ok';
  try {
    const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM docs').first<{ n: number }>();
    docs = row?.n ?? 0;
  } catch {
    db = 'error';
  }
  return c.json({ ok: db === 'ok', app: 'ev5', env: c.env.ENV_NAME ?? 'unknown', commit: c.env.COMMIT ?? 'unknown', db, docs }, db === 'ok' ? 200 : 503);
});

app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

// Everything else is the built app (wrangler `assets`).
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
