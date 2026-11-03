// In-memory CeilingStore for tests and local runs. The D1 store must keep the same atomic contract.
import type { CeilingStore, Limit, Window } from "./ceilings.ts";

export function memoryStore(): CeilingStore {
  const totals = new Map<string, number>();
  const held = new Map<string, { amount: number; limits: Limit[] }>();
  const slot = (w: Window, k: string) => `${w}:${k}`;
  const add = (limits: Limit[], n: number) => {
    for (const l of limits)
      totals.set(
        slot(l.window, l.key),
        (totals.get(slot(l.window, l.key)) ?? 0) + n,
      );
  };
  return {
    async reserve({ id, amount, limits }) {
      if (held.has(id)) throw new Error(`reservation ${id} already exists`);
      for (const l of limits) {
        const used = totals.get(slot(l.window, l.key)) ?? 0;
        if (used + amount > l.limit)
          return { ok: false, window: l.window, used, limit: l.limit };
      }
      add(limits, amount);
      held.set(id, { amount, limits });
      return { ok: true };
    },
    async settle(id, actual) {
      const h = held.get(id);
      if (!h) throw new Error(`no reservation ${id}`);
      add(h.limits, actual - h.amount);
      h.amount = actual;
    },
    async release(id) {
      const h = held.get(id);
      if (!h) return;
      add(h.limits, -h.amount);
      held.delete(id);
    },
    async used(w, k) {
      return totals.get(slot(w, k)) ?? 0;
    },
  };
}
