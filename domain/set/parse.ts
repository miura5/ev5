import { studySetSchema, type StudySet } from './types.ts';

/** Validates a set document against the frozen ev4 schema 3; throws otherwise. Stored answers are refused. */
export function parseSet(raw: unknown): StudySet {
  return studySetSchema.parse(raw);
}
