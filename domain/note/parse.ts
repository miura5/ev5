import { docBytes } from './size.ts';
import { MAX, noteSchema, type Note } from './types.ts';

/** Validates a note document against the frozen legacy schema 1; throws otherwise. */
export function parseNote(raw: unknown): Note {
  return noteSchema.parse(raw);
}

/**
 * Why a write leaving `doc` (prev: as stored, null for a create) is refused, or null when it is sound: the schema, the
 * 256 KB cap, and createdAt and earlierOf written once and never changed.
 */
export function writeProblem(doc: unknown, prev: Note | null): string | null {
  let note: Note;
  try {
    note = parseNote(doc);
  } catch (e) {
    return (e as Error).message;
  }
  const size = docBytes(note);
  if (size > MAX.documentBytes) return `note is ${size} bytes; a note holds at most ${MAX.documentBytes}`;
  if (prev)
    for (const k of ['createdAt', 'earlierOf'] as const)
      if (JSON.stringify(prev[k]) !== JSON.stringify(note[k]))
        return `note: ${k} is written once, when the note is made, and never changed`;
  return null;
}
