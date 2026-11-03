import type { Pin } from './types.ts';

/** Pins in Matt's order: by pos, ties by when pinned, then by target so the order is always the same. */
export function orderPins(pins: readonly Pin[]): Pin[] {
  return [...pins].sort(
    (a, b) =>
      a.pos - b.pos ||
      a.at.localeCompare(b.at) ||
      a.targetC.localeCompare(b.targetC) ||
      a.targetId.localeCompare(b.targetId),
  );
}

/**
 * The ordered pins whose target still exists (`exists(targetC, targetId)`). A pin to a deleted item is hidden, never
 * dropped: the row stays, so restoring the item shows the pin again (PLAN §5.10).
 */
export function visiblePins(pins: readonly Pin[], exists: (targetC: string, targetId: string) => boolean): Pin[] {
  return orderPins(pins).filter((p) => exists(p.targetC, p.targetId));
}

/** The pin on a target, if any. */
export const pinAt = (pins: readonly Pin[], targetC: string, targetId: string): Pin | undefined =>
  pins.find((p) => p.targetC === targetC && p.targetId === targetId);

/** Whether a target is pinned. */
export const isPinned = (pins: readonly Pin[], targetC: string, targetId: string): boolean =>
  pinAt(pins, targetC, targetId) !== undefined;

/** The pos for a new pin: after every existing one (the first is 1). */
export const nextPos = (pins: readonly Pin[]): number => pins.reduce((m, p) => Math.max(m, p.pos), 0) + 1;
