// The Worker's cron entry (CONTRACT §cmd.registry): each fire runs the registry's schedule commands whose cadence matches
// that cron, through the same handlers the routes use. Only instant commands run here; job-effect ones attach with S-80.
import { centralDate, centralParts, isDue, weekday } from "../domain/index.ts";
import { d1JobStore, newJob } from "../jobs/index.ts";
import { commands } from "../commands/index.ts";
import type { DocsD1 } from "../data/index.ts";
import { commandHandlers } from "./command-handlers.ts";

/** The cron expression a command's cadence needs, or null when no cron fires it yet ("every:15m" only). */
export function cronFor(every: string | undefined): string | null {
  return every === "every:15m" ? "*/15 * * * *" : null;
}

/** Central wall times (HH:MM) of the daily job-effect commands, and the weekday (0 = Sunday) of the weekly one. Defaults. */
export const SCHEDULE: Record<string, { time: string; weekday?: number }> = {
  morning: { time: "05:00" },
  evening: { time: "20:00" },
  weekly_review: { time: "05:00", weekday: 0 },
};

/** The job kind each scheduled command starts. None is attached yet (§job.kinds: a new kind needs a Chart decision). */
export const SCHEDULED_KINDS: Record<string, string> = {};

/** Nothing is scheduled from 01:00 to 03:00 Central (§job.schedule), where daylight saving moves the clock. */
export const inQuietWindow = (now: number): boolean => {
  const t = centralParts(now).time;
  return t >= "01:00" && t < "03:00";
};

/** The id of a command's run for a Central date; the same id twice is refused by the store, so a date runs once. */
export const runId = (name: string, date: string): string => `${name}@${date}`;

/** True when the command is due now: its Central wall time has passed and no run exists for that Central date (§job.schedule). */
export function dueNow(
  name: string,
  now: number,
  runDates: readonly string[],
): boolean {
  const s = SCHEDULE[name];
  if (!s || inQuietWindow(now)) return false;
  if (s.weekday !== undefined && weekday(centralDate(now)) !== s.weekday)
    return false;
  return isDue(now, s.time, runDates);
}

/** Runs each due command once; one that throws does not stop the others. Returns the names that ran, and
 * "skipped:<name>" for a due job command with no job kind attached yet. */
export async function runScheduled(
  env: { DB: DocsD1 },
  cron: string,
  now: number,
): Promise<string[]> {
  const ran: string[] = [];
  const store = d1JobStore(env.DB as never, () => now);
  let records: Awaited<ReturnType<typeof store.list>> | undefined;
  for (const c of commands) {
    if (
      c.callers.schedule &&
      c.effect === "job" &&
      SCHEDULE[c.name] &&
      cron === "*/15 * * * *"
    ) {
      try {
        records ??= await store.list();
        const kind = SCHEDULED_KINDS[c.name];
        const runDates = records
          .filter((r) => r.kind === kind)
          .map((r) => centralDate(Date.parse(r.createdAt)));
        if (!dueNow(c.name, now, kind ? runDates : [])) continue;
        if (!kind) {
          console.warn(`scheduled ${c.name} is due but has no job kind yet`);
          ran.push(`skipped:${c.name}`);
          continue;
        }
        const at = new Date(now).toISOString();
        const made = await store.put(
          newJob({
            id: runId(c.name, centralDate(now)),
            kind,
            title: c.title,
            at,
          }),
        );
        if (made) ran.push(c.name);
      } catch (e) {
        console.error(`scheduled ${c.name} failed`, e);
      }
      continue;
    }
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
