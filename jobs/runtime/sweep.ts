// The stale-job sweep (CONTRACT §job.record): a queued or running job whose runner was lost is moved to failed in
// plain words, so Activity shows it and Matt can retry. It never touches needs-you jobs (§job.needs-you), never
// re-fires a job, and keeps cost and any output pointer already on the record.
import { deadlinesFor } from "./define.ts";
import { transition } from "./record.ts";
import type { JobStore } from "./record.ts";

/** @public */
export const SWEEP_REASON =
  "Stopped: it never finished because its runner was lost. Start it again.";

/** Fails each queued or running job idle past its kind's deadline; returns the ids it failed. */
export async function sweepStale(
  store: JobStore,
  now: string,
): Promise<string[]> {
  const t = Date.parse(now);
  if (Number.isNaN(t)) throw new Error("sweepStale: now must be a date-time");
  const failed: string[] = [];
  for (const rec of await store.list()) {
    if (rec.state !== "queued" && rec.state !== "running") continue;
    const limit = deadlinesFor(rec.kind)[rec.state] * 60_000;
    if (t - Date.parse(rec.updatedAt) <= limit) continue;
    // Compare-and-set: a job that finished or moved since the list wins, and is left as it is.
    if (
      await store.put(
        transition(rec, { to: "failed", at: now, reason: SWEEP_REASON }),
      )
    )
      failed.push(rec.id);
  }
  return failed;
}
