import { describe, expect, test } from 'vitest';
import { noteBlank, noteBlocks, noteDoc, noteRuns, noteTitleOf, parseNote, splitWide, type Block } from './index.ts';

const r = (text: string, m: Record<string, unknown> = {}) => ({ text, ...m });
const AT = '2026-10-26T15:00:00.000Z';

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

describe('runs and blocks', () => {
  test('stored blocks are stable and parse against the schema', () => {
    const blocks = noteBlocks(SAMPLE);
    expect(noteBlocks(blocks)).toEqual(blocks);
    const doc = noteDoc(null, { blocks, at: AT });
    expect(parseNote(doc)).toEqual(doc);
    expect(doc.title).toBe('Fluids and electrolytes');
    expect(doc.createdAt).toBe(doc.at);
  });

  test('runs: empties dropped, neighbours joined, unsafe links and control characters cleaned', () => {
    expect(noteRuns([r(''), r('a'), r('b'), r('c', { b: true })])).toEqual([r('ab'), r('c', { b: true })]);
    expect(noteRuns([r('x', { href: 'javascript:alert(1)' })])).toEqual([r('x')]);
    expect(noteRuns([r('a​b\tc\u0001')])).toEqual([r('ab c')]);
  });

  test('a run past 20000 characters goes on as more runs; nothing is cut', () => {
    const long = noteRuns([r('y'.repeat(45000), { i: true })]);
    expect(long.map((x) => x.text).join('')).toHaveLength(45000);
    expect(long.every((x) => x.i && x.text.length <= 20000)).toBe(true);
    expect(noteRuns(Array.from({ length: 450 }, (_, i) => r('x' + i, i % 2 ? { b: true } : {})))).toHaveLength(450);
  });

  test('block fields: unknown type is a paragraph, indent only on lists, todo always has checked', () => {
    expect(noteBlocks([{ type: 'div', runs: [r('a')], indent: 3 }])).toEqual([{ type: 'p', runs: [r('a')] }]);
    expect(noteBlocks([{ type: 'ul', indent: 99, runs: [] }])[0]?.indent).toBe(6);
    expect(noteBlocks([{ type: 'todo', runs: [] }])[0]?.checked).toBe(false);
    expect(noteBlocks([])).toEqual([{ type: 'p', runs: [] }]);
  });

  test('pictures keep key, clamped width and alt; a bad key is a paragraph', () => {
    const key = 'note-images/abcdefghijklmnop.png';
    expect(noteBlocks([{ type: 'img', key, width: 5000, alt: 'a', runs: [r('no')] }])).toEqual([
      { type: 'img', runs: [], key, width: 2000, alt: 'a' },
    ]);
    expect(noteBlocks([{ type: 'img', key: 'x/y.png', runs: [] }])[0]?.type).toBe('p');
  });

  test('two-column rows: gathered, column 0 first; a one-column row goes full width, no text lost', () => {
    const row = (s: string, col: 0 | 1): Block => ({
      type: 'p',
      runs: [r(s)],
      row: 'r1',
      col,
    });
    const out = noteBlocks([row('right', 1), { type: 'p', runs: [r('mid')] }, row('left', 0)]);
    expect(out.map((b) => [b.runs[0]?.text, b.col])).toEqual([
      ['left', 0],
      ['right', 1],
      ['mid', undefined],
    ]);
    const single = noteBlocks([row('only', 0), { type: 'p', runs: [r('after')] }]);
    expect(single).toEqual([
      { type: 'p', runs: [r('only')] },
      { type: 'p', runs: [r('after')] },
    ]);
  });

  test('title follows the first heading 1, else the first heading; blank notes', () => {
    expect(
      noteTitleOf(
        noteBlocks([
          { type: 'h2', runs: [r('  Renal   system ')] },
          { type: 'h1', runs: [r('Top')] },
        ])
      )
    ).toBe('Top');
    expect(noteTitleOf(noteBlocks([{ type: 'h3', runs: [r('  Renal   system ')] }]))).toBe('Renal system');
    expect(noteTitleOf(noteBlocks([{ type: 'p', runs: [r('x')] }]))).toBe('');
    expect(noteBlank(noteBlocks([{ type: 'p', runs: [r('  ')] }]))).toBe(true);
    expect(noteBlank(noteBlocks(SAMPLE))).toBe(false);
  });

  test('a paragraph of 450 runs is split into following lines of at most 400, all text kept', () => {
    const runs = Array.from({ length: 450 }, (_, i) => r('w' + i + ' ', i % 2 ? { b: true } : { i: true }));
    const out = splitWide([{ type: 'p', runs }]);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.every((b) => b.runs.length <= 400)).toBe(true);
    expect(out.map((b) => b.runs.map((x) => x.text).join('')).join('')).toBe(runs.map((x) => x.text).join(''));
  });
});
