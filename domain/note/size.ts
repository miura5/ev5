import { MAX, type Block, type Note } from './types.ts';

/** Room kept under the cap so a stale save can always become a second note ("<title> (earlier)" plus its earlierOf). */
const EARLIER_ROOM = 256;

/** The bytes a document takes stored (UTF-8 of its JSON). */
export const docBytes = (doc: unknown): number => new TextEncoder().encode(JSON.stringify(doc)).length;

const maxRuns = (blocks: Block[]) => blocks.reduce((m, b) => Math.max(m, b.runs.length), 0);

/** Why these blocks can't be one note, in Matt's words, or '' when they can: past 4000 lines or 400 runs a line. */
export function fits(blocks: Block[]): string {
  if (blocks.length > MAX.blocks) return 'A note holds up to 4,000 lines. Start a new note for the rest.';
  if (maxRuns(blocks) > MAX.runs) return 'A line holds up to 400 changes of formatting. Split it into shorter lines.';
  return '';
}

/** Why a document is too big to save, or '': the 256 KB cap less the room a second note needs. */
export function tooBig(doc: Note): string {
  const bytes = docBytes(doc);
  const limit = MAX.documentBytes - EARLIER_ROOM;
  if (bytes <= limit) return '';
  const kb = (b: number, round: (n: number) => number) => (round((b / 1024) * 10) / 10).toFixed(1);
  return `This note would be too long to save: ${kb(bytes, Math.ceil)} KB against a limit of ${kb(limit, Math.floor)} KB. Start a new note for the rest.`;
}

/**
 * Whether an edit may be applied: it fits, or the note is already past a limit and the edit is no further past any
 * (no more lines, runs a line or bytes), so an oversized note can always be cut down.
 */
export function editAllowed(next: Note, now: Note): boolean {
  const over = (n: Note) => fits(n.blocks) !== '' || tooBig(n) !== '';
  if (!over(next)) return true;
  return (
    next.blocks.length <= now.blocks.length &&
    maxRuns(next.blocks) <= maxRuns(now.blocks) &&
    docBytes(next) <= docBytes(now)
  );
}
