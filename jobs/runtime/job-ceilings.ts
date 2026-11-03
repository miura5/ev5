// Ceilings (the runtime's cents interface) on top of the micro-dollar CeilingStore (S-63). 1 cent = 10,000 micro-dollars.
import { reserve, settle, release } from "./ceilings.ts";
import type { CeilingConfig, CeilingStore } from "./ceilings.ts";
import type { Ceilings } from "./workflow.ts";

const MICRO_PER_CENT = 10_000;
const micro = (cents: number) => Math.ceil(cents * MICRO_PER_CENT);

/**
 * A step reserves its maximum, then records what it spent. A retried attempt first releases its unsettled hold, so a
 * failed attempt never keeps money reserved. `usage` is keyed by instance, step and attempt: a repeat counts once.
 */
export function jobCeilings(
  store: CeilingStore,
  config: () => Promise<CeilingConfig>,
  now: () => Date,
  newId: () => string,
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
