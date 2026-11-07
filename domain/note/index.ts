import { noteBlocks, noteTitleOf } from './blocks.ts';
import { MAX, type Note } from './types.ts';
export {
  /** @public */
  BLOCK_TYPES,
  /** @public */
  LIST_TYPES,
  /** @public */
  MARKS,
  /** @public */
  MAX,
  /** @public */
  IMG_KEY,
  type Run,
  type Block,
  type Note,
} from './types.ts';
export { noteRuns, noteBlocks, splitWide, noteTitleOf, noteBlank } from './blocks.ts';
export { docBytes, fits, tooBig, editAllowed } from './size.ts';
export { parseNote, writeProblem } from './parse.ts';

const ID = /^n-\d{8}-\d{6}-[A-Za-z0-9]{8,40}$/;
const EARLIER = ' (earlier)';

/** A new note's id, n-<YYYYMMDD-HHMMSS in UTC>-<random>; the caller supplies at least 12 letters or digits of randomness. */
export function newNoteId(at: string, random: string): string {
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) throw new Error('newNoteId: no time');
  const tail = random.replace(/[^A-Za-z0-9]/g, '');
  if (tail.length < 12) throw new Error('newNoteId: the random part needs 12 or more letters and digits');
  const iso = t.toISOString();
  return `n-${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 19).replace(/:/g, '')}-${tail.slice(0, 40)}`;
}

export const noteIdOk = (id: unknown): boolean => ID.test(String(id ?? ''));

/** The title of the second note a stale save becomes: "<title> (earlier)", cut to fit 300, never "(earlier)" twice. */
export function earlierTitle(title: string): string {
  const t = title.endsWith(EARLIER) ? title.slice(0, -EARLIER.length) : title;
  return (t.trim() || 'Untitled').slice(0, MAX.title - EARLIER.length) + EARLIER;
}

type Save = {
  blocks: unknown;
  at: string;
};

/**
 * The note as a save writes it: the earlier document's identity kept (createdAt, earlierOf), blocks and title from the editor, the envelope stamped now. A second note's title keeps "(earlier)".
 */
export function noteDoc(prev: Note | null, save: Save): Note {
  const blocks = noteBlocks(save.blocks);
  const title = noteTitleOf(blocks);
  const doc: Note = {
    schema: 1,
    writer: 'page',
    at: save.at,
    createdAt: prev?.createdAt ?? save.at,
    title: prev?.earlierOf ? earlierTitle(title) : title,
    blocks,
    editedAt: save.at,
  };
  if (prev?.earlierOf !== undefined) doc.earlierOf = prev.earlierOf;
  return doc;
}

/** The same words: the blocks, which is all a note's text is (the stamps aside). */
export const sameWords = (a: Note, b: Note): boolean => JSON.stringify(a.blocks) === JSON.stringify(b.blocks);

export type StaleSave = { kind: 'same' } | { kind: 'both'; earlierId: string; earlier: Note };

/**
 * A save that found the record changed elsewhere (stale): never merged and never written over. The version in the
 * record stays the note; his version becomes a second note, a new note made now, earlierOf the original, titled
 * "<title> (earlier)" When the record already holds his words, there is nothing to keep.
 */
export function resolveStale(args: { id: string; his: Note; current: Note; at: string; random: string }): StaleSave {
  const { id, his, current, at, random } = args;
  if (sameWords(current, his)) return { kind: 'same' };
  const earlier: Note = {
    ...his,
    at,
    createdAt: at,
    title: earlierTitle(his.title),
    earlierOf: id,
    editedAt: his.editedAt ?? at,
  };
  return { kind: 'both', earlierId: newNoteId(at, random), earlier };
}
