// The Worker's cron entry (CONTRACT §cmd.registry): each fire runs the registry's schedule commands whose cadence matches
// that cron, through the same handlers the routes use. Only instant commands run here; job-effect ones attach with S-80.
import { commands } from "../commands/index.ts";
import type { DocsD1 } from "../data/index.ts";
import { commandHandlers } from "./command-handlers.ts";

/** The cron expression a command's cadence needs, or null when no cron fires it yet ("every:15m" only). */
export function cronFor(every: string | undefined): string | null {
  return every === "every:15m" ? "*/15 * * * *" : null;
}

/** Runs each due command once; one that throws does not stop the others. Returns the names that ran. */
export async function runScheduled(
  env: { DB: DocsD1 },
  cron: string,
  now: number,
): Promise<string[]> {
  const ran: string[] = [];
  for (const c of commands) {
    if (!c.callers.schedule || c.effect !== "instant") continue;
    if (cronFor(c.every) !== cron) continue;
    const handler = commandHandlers[c.name];
    if (!handler) continue;
    try {
      await handler({} as never, "schedule", {
        db: env.DB,
        clock: () => now,
        newId: () => crypto.randomUUID(),
      });
      ran.push(c.name);
    } catch (e) {
      console.error(`scheduled ${c.name} failed`, e);
    }
  }
  return ran;
}
