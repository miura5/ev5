// Ceilings (the runtime's cents interface) on top of the micro-dollar CeilingStore (S-63). 1 cent = 10,000 micro-dollars.
import { reserve, settle, release } from "./ceilings.ts";
import type { CeilingConfig, CeilingStore } from "./ceilings.ts";
import type { Ceilings } from "./workflow.ts";
import { newJob, transition, update } from "./record.ts";
import type { JobStore } from "./record.ts";

const MICRO_PER_CENT = 10_000;
const micro = (cents: number) => Math.ceil(cents * MICRO_PER_CENT);

export const SPEND_ALERT_KIND = "spend-alert";

/**
 * The 80% alert as one Activity needs-you record per month (CONTRACT §model.alert). The id carries the month and
 * the store refuses a second create, so the alert never repeats within a month. Ceiling windows are UTC.
 */
export function spendAlertWriter(store: JobStore) {
  return async (line: string, at: Date): Promise<void> => {
    const iso = at.toISOString();
    const rec = newJob({
      id: `${SPEND_ALERT_KIND}:${iso.slice(0, 7)}`,
      kind: SPEND_ALERT_KIND,
      title: "Monthly spend",
      at: iso,
    });
    if (await store.get(rec.id)) return;
    await store.put({
      ...rec,
      state: "needs-you",
      reason: line,
      step: "acknowledge",
      needsYouAt: iso,
    });
  };
}

/**
 * Matt's acknowledge on the spend alert: needs-you moves to done (terminal), so Activity files it under done and Today's
 * line goes. Refuses any other kind, and an alert that is no longer waiting.
 */
export async function acknowledgeSpendAlert(
  store: JobStore,
  id: string,
  at: Date,
) {
  const cur = await store.get(id);
  if (!cur || cur.kind !== SPEND_ALERT_KIND)
    throw new Error(`job ${id}: not a spend alert`);
  if (cur.state !== "needs-you")
    throw new Error(`job ${id}: the alert is not waiting`);
  return update(store, id, (r) =>
    transition(r, {
      to: "done",
      at: at.toISOString(),
      output: { home: "activity", id },
    }),
  );
}

/**
 * A step reserves its maximum, then records what it spent, which closes the hold. A retried attempt first releases
 * its unsettled hold, so a failed attempt never keeps money reserved. `usage` is keyed by instance, step and attempt
 * and the key is stored with the hold: a repeat counts once, even after a restart.
 */
export function jobCeilings(
  store: CeilingStore,
  config: () => Promise<CeilingConfig>,
  now: () => Date,
  newId: () => string,
  onAlert?: (line: string, at: Date) => Promise<void>,
): Ceilings {
  // Holds live in the store (a job's holds start with hold_ and its id), so a restarted Worker still finds them.
  const prefix = (jobId: string) => `hold_${jobId}:`;
  return {
    async reserve(jobId, maxCents) {
      const stale = await store.findOpen(prefix(jobId));
      if (stale) await release(store, stale);
      const id = `${prefix(jobId)}${newId()}`;
      const r = await reserve(store, await config(), {
        id,
        jobId,
        amount: micro(maxCents),
        now: now(),
      });
      if (!r.ok) throw new Error(r.reason);
      if (r.alert && onAlert) {
        try {
          await onAlert(r.alert.line, now());
        } catch {
          // the alert is a notice: a failed write never stops the job that crossed the line
        }
      }
    },
    async record(key, jobId, cents) {
      if (await store.usageSeen(key)) return;
      const hold = await store.findOpen(prefix(jobId));
      if (!hold) throw new Error(`no reservation for ${key}`);
      await settle(store, hold, micro(cents), key);
    },
  };
}
