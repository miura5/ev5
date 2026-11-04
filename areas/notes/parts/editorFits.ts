import type { Block } from '../../../domain/index.ts';

// notes.schema.json's limits, kept here until the domain barrel exports fits and splitWide (domain/note/size.ts,
// blocks.ts); the change is a one-line export in domain/index.ts, outside this slice.
const MAX_BLOCKS = 4000;
const MAX_RUNS = 400;

export const maxRuns = (bs: readonly Pick<Block, 'runs'>[]) => bs.reduce((m, b) => Math.max(m, b.runs.length), 0);

/** Why these blocks can't be one note, in Matt's words, or '' when they can (ev4's noteFits). */
export function fits(blocks: readonly Block[]): string {
  if (blocks.length > MAX_BLOCKS) return 'A note holds up to 4,000 lines. Start a new note for the rest.';
  if (maxRuns(blocks) > MAX_RUNS) return 'A line holds up to 400 changes of formatting. Split it into shorter lines.';
  return '';
}

/** Blocks with more than 400 runs split into following paragraphs of 400 runs each, all text kept (noteSplitWide). */
export function splitWide(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((b) => {
    if (b.runs.length <= MAX_RUNS) return [b];
    const parts: Block[] = [];
    for (let i = 0; i < b.runs.length; i += MAX_RUNS) {
      const runs = b.runs.slice(i, i + MAX_RUNS);
      parts.push(i ? { type: 'p', runs } : { ...b, runs });
    }
    return parts;
  });
}
