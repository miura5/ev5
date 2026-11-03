// Cost ceilings (S-63, CONTRACT §model.ceilings, §model.alert). Pure code: storage is injected.
// All money is whole micro-dollars (1 USD = 1_000_000). No prices live here: callers pass them in
// from models.ts, and the ceiling amounts are config values (D1 settings), never constants.

export type Window = 'hour' | 'day' | 'month' | 'job';

export interface CeilingConfig {
  hourly: number;
  daily: number;
  monthly: number;
  perJob: number;
}

export interface Limit {
  window: Window;
  key: string; // e.g. "2026-11-03T14", "2026-11-03", "2026-11", or the job id
  limit: number;
}

export type StoreResult = { ok: true } | { ok: false; window: Window; used: number; limit: number };

// The store counts reserved plus billed cost. `reserve` must be atomic across all its limits
// (one D1 batch/transaction): either every limit has room and the amount is added to each, or nothing changes.
export interface CeilingStore {
  reserve(req: { id: string; amount: number; limits: Limit[] }): Promise<StoreResult>;
  settle(id: string, actual: number): Promise<void>; // reservation becomes the billed amount
  release(id: string): Promise<void>; // nothing was billed
  used(window: Window, key: string): Promise<number>;
}

export interface Alert {
  needsYou: true;
  line: string; // the one line on Today and the Activity text
}

export type ReserveResult = { ok: true; id: string; alert?: Alert } | { ok: false; window: Window; reason: string };

export const ALERT_AT = 0.8;

export function windowKeys(now: Date, jobId: string): Record<Window, string> {
  const iso = now.toISOString(); // UTC windows
  return { hour: iso.slice(0, 13), day: iso.slice(0, 10), month: iso.slice(0, 7), job: jobId };
}

export function validateConfig(c: CeilingConfig): void {
  for (const [k, v] of Object.entries(c)) {
    if (!Number.isInteger(v) || v < 0) {
      throw new Error(`ceiling ${k} must be a whole number of micro-dollars, 0 or more`);
    }
  }
}

// Worst-case cost of one call: all input tokens plus every output token the call may produce.
// Prices are micro-dollars per million tokens, from models.ts.
export function maxCost(
  p: { inputPerMTok: number; outputPerMTok: number },
  inputTokens: number,
  maxOutputTokens: number,
): number {
  return Math.ceil((inputTokens * p.inputPerMTok + maxOutputTokens * p.outputPerMTok) / 1_000_000);
}

const usd = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`;
const NAME: Record<Window, string> = { hour: 'hourly', day: 'daily', month: 'monthly', job: 'per-job' };

export function ceilingReason(window: Window, used: number, limit: number, amount: number): string {
  return (
    `Stopped before it started: this step could cost up to ${usd(amount)}, which would pass the ${NAME[window]} ` +
    `limit of ${usd(limit)} (${usd(used)} already counted). Nothing was saved. ` +
    (window === 'job' ? 'Try a smaller request.' : 'Raise the limit in Settings or wait for the window to reset.')
  );
}

// Reserve a call's maximum cost before it starts. A hit fails cleanly with a plain-words reason.
export async function reserve(
  store: CeilingStore,
  config: CeilingConfig,
  call: { id: string; jobId: string; amount: number; now: Date },
): Promise<ReserveResult> {
  validateConfig(config);
  const k = windowKeys(call.now, call.jobId);
  const limits: Limit[] = [
    { window: 'job', key: k.job, limit: config.perJob },
    { window: 'hour', key: k.hour, limit: config.hourly },
    { window: 'day', key: k.day, limit: config.daily },
    { window: 'month', key: k.month, limit: config.monthly },
  ];
  const r = await store.reserve({ id: call.id, amount: call.amount, limits });
  if (!r.ok) {
    return { ok: false, window: r.window, reason: ceilingReason(r.window, r.used, r.limit, call.amount) };
  }
  const after = await store.used('month', k.month);
  const threshold = config.monthly * ALERT_AT;
  if (config.monthly > 0 && after >= threshold && after - call.amount < threshold) {
    return {
      ok: true,
      id: call.id,
      alert: {
        needsYou: true,
        line: `E.V. has used ${usd(after)} of the ${usd(config.monthly)} monthly limit (80%).`,
      },
    };
  }
  return { ok: true, id: call.id };
}

export const settle = (store: CeilingStore, id: string, actual: number) => store.settle(id, actual);
export const release = (store: CeilingStore, id: string) => store.release(id);
