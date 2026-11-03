import type { Pin, TargetState } from './types.ts';

type StateOf = (c: string, id: string) => TargetState;

const same = (p: Pin, c: string, id: string): boolean => p.targetC === c && p.targetId === id;

/** Pins in display order: by pos, ties by target so the order is stable. */
export function pinOrder(pins: readonly Pin[]): Pin[] {
  return [...pins].sort(
    (a, b) => a.pos - b.pos || a.targetC.localeCompare(b.targetC) || a.targetId.localeCompare(b.targetId),
  );
}

export const isPinned = (pins: readonly Pin[], c: string, id: string): boolean => pins.some((p) => same(p, c, id));

/** Pins a target at the end; pinning an already pinned target changes nothing. */
export function pin(pins: readonly Pin[], c: string, id: string, at: string): Pin[] {
  if (isPinned(pins, c, id)) return [...pins];
  const last = pins.reduce((m, p) => Math.max(m, p.pos), 0);
  return [...pins, { targetC: c, targetId: id, pos: last + 1, at }];
}

/** Removes a pin; the rest keep their order. */
export const unpin = (pins: readonly Pin[], c: string, id: string): Pin[] => pins.filter((p) => !same(p, c, id));

/** Moves a pin to index `to` in display order, renumbering 1..n; a pin that is not there leaves the list as is. */
export function movePin(pins: readonly Pin[], c: string, id: string, to: number, at: string): Pin[] {
  const list = pinOrder(pins);
  const from = list.findIndex((p) => same(p, c, id));
  if (from < 0) return [...pins];
  const [moved] = list.splice(from, 1) as [Pin];
  list.splice(Math.max(0, Math.min(to, list.length)), 0, moved);
  return list.map((p, i) => (p.pos === i + 1 ? p : { ...p, pos: i + 1, at }));
}

/** What the sidebar shows: pins whose target is live, in order. Deleted targets stay stored, hidden, not lost. */
export function visiblePins(pins: readonly Pin[], state: StateOf): Pin[] {
  return pinOrder(pins).filter((p) => state(p.targetC, p.targetId) === 'live');
}

/** Pins whose target does not exist at all: reported as orphans, never dropped (§data.links). */
export function orphanPins(pins: readonly Pin[], state: StateOf): string[] {
  return pins.filter((p) => state(p.targetC, p.targetId) === 'missing').map((p) => `${p.targetC}/${p.targetId}`);
}
