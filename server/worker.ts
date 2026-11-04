// The Worker's entry (wrangler `main`): the Hono app plus the Workflow class the JOBS binding names. Kept apart from
// index.ts so route tests run in Node without the Cloudflare runtime.
import app from "./index.ts";
import type { Env } from "./index.ts";
import { runScheduled } from "./scheduled.ts";
// The cron entry: wrangler triggers.crons fire `scheduled`, which runs the registry's schedule commands.
export default {
  fetch: app.fetch,
  async scheduled(
    event: { cron: string; scheduledTime: number },
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ): Promise<void> {
    ctx.waitUntil(runScheduled(env as never, event.cron, event.scheduledTime));
  },
};
export { JobWorkflow } from "./job-workflow.ts";
// ev4's study-plan Durable Object, kept as a stub while the rollback window is open so a redeploy of ev4 finds its class
// and binding in place (CONTRACT §deliver.window). v5 never deletes it.
export class PlanJob {
  fetch(): Response {
    return new Response("PlanJob stub", { status: 410 });
  }
}
