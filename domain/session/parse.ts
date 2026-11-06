import { sessionSchema, type Session } from './types.ts';

/** Validates a session document; throws otherwise. The note's text is never accepted. */
export function parseSession(o: unknown): Session {
  return sessionSchema.parse(o);
}
