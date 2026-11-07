import { describe, expect, test } from 'vitest';
import {
  docBytes,
  earlierTitle,
  editAllowed,
  fits,
  newNoteId,
  noteBlank,
  noteBlocks,
  noteDoc,
  noteIdOk,
  noteRuns,
  noteTitleOf,
  parseNote,
  resolveStale,
  sameWords,
  splitWide,
  tooBig,
  writeProblem,
  type Block,
  type Note,
} from './index.ts';

// Ported from ev4 test/notes-editor.test.mjs and test/notes.test.mjs (the model parts); all text is made up.
const r = (text: string, m: Record<string, unknown> = {}) => ({ text, ...m });
const AT = '2026-10-26T15:00:00.000Z';
const ID = 'note_20261026-150000-abcdefghijkl';

const SAMPLE: Block[] = [
  { type: 'h1', runs: [r('Fluids and electrolytes')] },
  {
    type: 'p',
    runs: [r('Two, '), r('bold', { b: true }), r(' and '), r('both', { b: true, i: true, u: true })],
  },
  { type: 'ul', runs: [r('Range: '), r('3.5 to 5.0', { s: true })] },
  { type: 'ul', indent: 1, runs: [r('nested')] },
  { type: 'todo', checked: true, runs: [r('done')] },
  {
    type: 'p',
    runs: [r('see '), r('page', { href: 'https://example.com/a?b=1' })],
  },
  { type: 'p', runs: [] },
];

describe('ids', () => {
  test('a new id fits the key and the schema earlierOf pattern', () => {
    const id = newNoteId('2026-10-26T15:04:05.123Z', 'ABCDEFGHIJKLMNOP');
    expect(id).toBe('note_20261026-150405-ABCDEFGHIJKLMNOP');
    expect(noteIdOk(id)).toBe(true);
    expect(id).toMatch(/^note_[A-Za-z0-9-]{1,120}$/);
    expect(noteIdOk('note_1')).toBe(false);
    expect(() => newNoteId(AT, 'short')).toThrow();
    expect(() => newNoteId('nope', 'ABCDEFGHIJKLMNOP')).toThrow();
  });
});

describe('noteDoc', () => {
  const prev: Note = {
    schema: 1,
    writer: 'page',
    at: '2026-10-20T10:00:00Z',
    createdAt: '2026-10-20T10:00:00Z',
    title: 'Old',
    blocks: [],
    earlierOf: 'note_20261019-100000-abcdefghijkl',
  };
  const blocks = [
    { type: 'p', runs: [r('x')] },
    { type: 'h2', runs: [r('  Renal   system ')] },
  ];

  test('keeps identity and marks; an (earlier) copy keeps its suffix', () => {
    const doc = noteDoc(prev, { blocks, at: '2026-10-26T10:00:00Z' });
    expect(doc).toMatchObject({
      createdAt: prev.createdAt,
      earlierOf: prev.earlierOf,
      title: 'Renal system (earlier)',
      editedAt: '2026-10-26T10:00:00Z',
    });
    expect(noteDoc({ ...prev, earlierOf: undefined }, { blocks: doc.blocks, at: doc.at }).title).toBe('Renal system');
    expect(parseNote(doc)).toEqual(doc);
  });

  test('earlierTitle: Untitled, never twice, always within 300', () => {
    expect(earlierTitle('')).toBe('Untitled (earlier)');
    expect(earlierTitle('A (earlier)')).toBe('A (earlier)');
    expect(earlierTitle('z'.repeat(400))).toHaveLength(300);
  });
});

describe('parseNote and writeProblem', () => {
  const good = () => noteDoc(null, { blocks: SAMPLE, at: AT });
  test('refuses what the frozen schema refuses', () => {
    const bad = (patch: Record<string, unknown>) => () => parseNote({ ...good(), ...patch });
    expect(bad({ extra: 1 })).toThrow(/extra/);
    expect(bad({ schema: 2 })).toThrow();
    expect(bad({ writer: 'worker' })).toThrow();
    expect(bad({ title: 'x'.repeat(301) })).toThrow();
    expect(bad({ createdAt: 'yesterday' })).toThrow();
    expect(bad({ earlierOf: 'x1' })).toThrow();
    expect(bad({ blocks: [{ type: 'script', runs: [] }] })).toThrow();
    expect(bad({ blocks: [{ type: 'p', runs: [{ text: 'a', html: '<b>' }] }] })).toThrow();
    expect(
      bad({
        blocks: [{ type: 'p', runs: [{ text: 'a', href: 'javascript:alert(1)' }] }],
      })
    ).toThrow();
    expect(bad({ blocks: [{ type: 'p', runs: [{ text: 'a', b: false }] }] })).toThrow();
    expect(bad({ blocks: [{ type: 'p', runs: [], col: 2 }] })).toThrow();
    expect(
      bad({
        blocks: Array.from({ length: 4001 }, () => ({ type: 'p', runs: [] })),
      })
    ).toThrow();
    expect(() => parseNote(null)).toThrow();
  });

  test('refuses the old ev4 document fields', () => {
    for (const k of ['source', 'course', 'label', 'archivedAt', 'discardedAt'])
      expect(() => parseNote({ ...good(), [k]: null })).toThrow();
  });

  test('writeProblem: shape, size cap, createdAt and earlierOf written once', () => {
    const prev = good();
    expect(writeProblem(prev, null)).toBeNull();
    expect(writeProblem({ ...prev, extra: 1 }, null)).toMatch(/extra/);
    expect(writeProblem({ ...prev, createdAt: '2026-01-01T00:00:00Z' }, prev)).toMatch(/createdAt is written once/);
    expect(writeProblem({ ...prev, earlierOf: ID }, prev)).toMatch(/earlierOf is written once/);
    const big = {
      ...prev,
      blocks: Array.from({ length: 30 }, () => ({
        type: 'p',
        runs: [r('a'.repeat(10000))],
      })),
    };
    expect(writeProblem(big, null)).toMatch(/at most 262144/);
  });
});

describe('size budget', () => {
  const doc = (blocks: Block[]) => noteDoc(null, { blocks, at: AT });
  const lines = (n: number, text = 'line'): Block[] =>
    Array.from({ length: n }, () => ({ type: 'p', runs: [r(text)] }));

  test('fits refuses past 4000 lines or 400 runs a line, in his words', () => {
    expect(fits(lines(4000))).toBe('');
    expect(fits(lines(4001))).toMatch(/4,000 lines/);
    expect(fits([{ type: 'p', runs: Array.from({ length: 401 }, () => r('x')) }])).toMatch(/400/);
  });

  test('tooBig holds back room for a second note and rounds the sizes honestly', () => {
    expect(tooBig(doc(lines(10)))).toBe('');
    const edge = doc([{ type: 'p', runs: [r('a'.repeat(20000))] }]);
    const filler = Math.ceil((262144 - 256 - docBytes(edge)) / 20000);
    const over = doc(
      Array.from({ length: filler + 2 }, () => ({
        type: 'p',
        runs: [r('a'.repeat(20000))],
      }))
    );
    expect(tooBig(over)).toMatch(/too long to save: \d+\.\d KB against a limit of 255\.7 KB/);
  });

  test('an edit past a limit is refused unless it shrinks the note', () => {
    const now = doc(lines(4100));
    expect(editAllowed(doc(lines(4100)), now)).toBe(true);
    expect(editAllowed(doc(lines(4001)), now)).toBe(true);
    expect(editAllowed(doc(lines(4101)), now)).toBe(false);
    expect(editAllowed(doc(lines(4100, 'longer line')), now)).toBe(false);
    expect(editAllowed(doc(lines(5)), doc(lines(4)))).toBe(true);
  });
});

describe('stale save', () => {
  const current = noteDoc(null, {
    blocks: [{ type: 'h1', runs: [r('Renal')] }],
    at: '2026-10-26T14:00:00.000Z',
  });
  const his = noteDoc(current, {
    blocks: [
      { type: 'h1', runs: [r('Renal')] },
      { type: 'p', runs: [r('my new words')] },
    ],
    at: '2026-10-26T14:30:00.000Z',
  });

  test('both are kept: the older as an (earlier) copy, the current untouched', () => {
    const res = resolveStale({
      id: ID,
      his,
      current,
      at: AT,
      random: 'ABCDEFGHIJKLMNOP',
    });
    expect(res.kind).toBe('both');
    if (res.kind !== 'both') return;
    expect(noteIdOk(res.earlierId)).toBe(true);
    expect(res.earlierId).not.toBe(ID);
    expect(res.earlier).toMatchObject({
      title: 'Renal (earlier)',
      earlierOf: ID,
      createdAt: AT,
      at: AT,
    });
    expect(res.earlier.blocks).toEqual(his.blocks);
    expect(res.earlier.editedAt).toBe(his.editedAt);
    expect(parseNote(res.earlier)).toEqual(res.earlier);
    expect(writeProblem(res.earlier, null)).toBeNull();
  });

  test('when the record already holds his words nothing is kept twice', () => {
    expect(
      resolveStale({
        id: ID,
        his,
        current: { ...his, at: AT },
        at: AT,
        random: 'ABCDEFGHIJKLMNOP',
      })
    ).toEqual({ kind: 'same' });
    expect(sameWords(his, { ...his, blocks: current.blocks })).toBe(false);
  });
});
