import { weakSpotSchema, type WeakSpot } from './types.ts';

/** Validates a weak spot document against the frozen ev4 schema; throws otherwise. Stored derived state is refused. */
export function parseWeakSpot(o: unknown): WeakSpot {
  return weakSpotSchema.parse(o);
}
