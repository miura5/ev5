// Ceilings (the runtime's cents interface) on top of the micro-dollar CeilingStore (S-63). 1 cent = 10,000 micro-dollars.
import { reserve, settle, release } from "./ceilings.ts";
import type { CeilingConfig, CeilingStore } from "./ceilings.ts";
import type { Ceilings } from "./workflow.ts";
import { newJob } from "./record.ts";
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
 * A step reserves its maximum, then records what it spent. A retried attempt first releases its unsettled hold, so a
 * failed attempt never keeps money reserved. `usage` is keyed by instance, step and attempt: a repeat counts once.
 */
export function jobCeilings(
  store: CeilingStore,
  config: () => Promise<CeilingConfig>,
  now: () => Date,
  newId: () => string,
  onAlert?: (line: string, at: Date) => Promise<void>,
): Ceilings {
  const open = new Map<string, string>();
  const settled = new Set<string>();
  return {
    async reserve(jobId, maxCents) {
      const stale = open.get(jobId);
      if (stale) {
        open.delete(jobId);
        await release(store, stale);
      }
      const id = `${jobId}:hold:${newId()}`;
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
      open.set(jobId, id);
    },
    async record(key, jobId, cents) {
      if (settled.has(key)) return;
      const hold = open.get(jobId);
      if (!hold) throw new Error(`no reservation for ${key}`);
      settled.add(key);
      open.delete(jobId);
      await settle(store, hold, micro(cents));
    },
  };
}
