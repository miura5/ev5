// In-memory CeilingStore for tests and local runs. The D1 store must keep the same atomic contract.
import type { CeilingStore, Limit, Window } from "./ceilings.ts";

export function memoryStore(): CeilingStore {
  const totals = new Map<string, number>();
  const held = new Map<
    string,
    { amount: number; limits: Limit[]; open: boolean }
  >();
  const keys = new Map<string, string>();
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
      held.set(id, { amount, limits, open: true });
      return { ok: true };
    },
    async settle(id, actual, usageKey) {
      const h = held.get(id);
      if (!h || !h.open) throw new Error(`no reservation ${id}`);
      if (usageKey !== undefined && keys.has(usageKey))
        throw new Error(`usage ${usageKey} already settled`);
      add(h.limits, actual - h.amount);
      h.amount = actual;
      h.open = false;
      if (usageKey !== undefined) keys.set(usageKey, id);
    },
    async release(id) {
      const h = held.get(id);
      if (!h || !h.open) return;
      add(h.limits, -h.amount);
      held.delete(id);
    },
    async findOpen(prefix) {
      return [...held].find(([id, h]) => h.open && id.startsWith(prefix))?.[0];
    },
    async usageSeen(key) {
      return keys.has(key);
    },
    async used(w, k) {
      return totals.get(slot(w, k)) ?? 0;
    },
  };
}
