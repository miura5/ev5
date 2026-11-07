import { cleanup, render } from '@testing-library/react';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import { afterEach, expect, test } from 'vitest';
import type { Block } from '../../domain/index.ts';

type Run = Block['runs'][number];
import { blocksToDoc, docToBlocks } from './parts/editorDoc.ts';
import { editorPlugins } from './parts/editorKeys.ts';
import { NoteEditor } from './parts/NoteEditor.tsx';

afterEach(cleanup);

const r = (text: string, m: Omit<Run, 'text'> = {}): Run => ({ text, ...m });
const p = (text: string): Block => ({ type: 'p', runs: [r(text)] });
const KEY = 'note-images/abcdEFGH12345678.png';
const combos: Run[] = [];
for (let n = 0; n < 32; n++) {
  combos.push(
    r('w' + n + ' ', {
      ...(n & 1 ? { b: true as const } : {}),
      ...(n & 2 ? { i: true as const } : {}),
      ...(n & 4 ? { u: true as const } : {}),
      ...(n & 8 ? { s: true as const } : {}),
      ...(n & 16 ? { href: 'https://example.com/c' + n } : {}),
    }),
  );
}
const cell = (b: Block, col: 0 | 1): Block => ({ ...b, row: 'r1', col });

// Cases from the S-08 corpus (docs/spikes/S-08-notes-editor.md): ev4's stored, normal-form blocks.
const FIXTURES: Record<string, Block[]> = {
  'every block type': [
    { type: 'h1', runs: [r('Water cycle')] },
    { type: 'h2', runs: [r('Systole')] },
    { type: 'h3', runs: [] },
    p('Plain words.'),
    { type: 'p', runs: [] },
    { type: 'ul', runs: [r('one')] },
    { type: 'ol', runs: [r('first')] },
    { type: 'todo', runs: [r('done')], checked: true },
    { type: 'todo', runs: [], checked: false },
  ],
  'pictures at the limits': [
    { type: 'img', runs: [], key: KEY },
    { type: 'img', runs: [], key: KEY, width: 480, alt: 'heart diagram' },
    {
      type: 'img',
      runs: [],
      key: 'note-images/' + 'a'.repeat(16) + '.png',
      width: 40,
    },
    {
      type: 'img',
      runs: [],
      key: 'note-images/' + 'B'.repeat(64) + '.jpg',
      width: 2000,
    },
  ],
  'all 32 mark combinations': [{ type: 'p', runs: combos }],
  'two links side by side': [
    {
      type: 'p',
      runs: [r('one', { href: 'http://example.com/1' }), r('two', { href: 'http://example.com/2' })],
    },
  ],
  'unicode and markup characters': [p('é ü 漢字 😀 <b>&amp;</b> "q" \'s\'  two  spaces')],
  'a run past the 20,000 cap, stored as three runs': [
    {
      type: 'p',
      runs: [r('x'.repeat(20000)), r('x'.repeat(20000)), r('x'.repeat(5000))],
    },
  ],
  'indents 0 to 6 and a jump': [
    ...[0, 1, 2, 3, 4, 5, 6].map(
      (indent): Block => ({
        type: 'ul',
        runs: [r('i' + indent)],
        ...(indent ? { indent } : {}),
      }),
    ),
    { type: 'p', runs: [r('between')] },
    { type: 'ol', runs: [r('jump')], indent: 3 },
    { type: 'todo', runs: [r('t')], checked: false, indent: 2 },
  ],
  'a row with a picture and text': [
    p('before'),
    cell({ type: 'img', runs: [], key: KEY, width: 300 }, 0),
    cell({ type: 'p', runs: [r('beside')] }, 1),
    cell({ type: 'h2', runs: [r('head')] }, 1),
    cell({ type: 'ul', runs: [r('item', { b: true })] }, 1),
    p('after'),
  ],
  'a long note': Array.from(
    { length: 4000 },
    (_, i): Block => (i % 3 ? p('line ' + i) : { type: 'ul', runs: [r('l' + i)] }),
  ),
};

test.each(Object.entries(FIXTURES))('round trip is byte-equal: %s', (_name, blocks) => {
  const back = docToBlocks(blocksToDoc(blocks));
  expect(JSON.stringify(back)).toBe(JSON.stringify(blocks));
});

test('an empty note gets one paragraph; a row short of a column is laid flat', () => {
  expect(docToBlocks(blocksToDoc([]))).toEqual([{ type: 'p', runs: [] }]);
  const lone: Block[] = [{ type: 'p', runs: [r('only')], row: 'r1', col: 0 }];
  expect(docToBlocks(blocksToDoc(lone))).toEqual([p('only')]);
});

const press = (state: EditorState, key: string) => {
  let out = state;
  const ev = { key, shiftKey: false } as KeyboardEvent;
  for (const pl of state.plugins) {
    const h = pl.props.handleKeyDown;
    if (h?.call(pl, { state, dispatch: (tr: Transaction) => (out = out.apply(tr)) } as never, ev)) break;
  }
  return out;
};
const at = (blocks: Block[], text: string, offset: number) => {
  const state = EditorState.create({
    doc: blocksToDoc(blocks),
    plugins: editorPlugins(),
  });
  let pos = 0;
  state.doc.descendants((n, ps) => {
    if (n.isText && n.text === text) pos = ps + offset;
  });
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));
};

test('Enter in a ticked todo starts an unticked one; on an empty item it ends the list', () => {
  const s = press(at([{ type: 'todo', runs: [r('done')], checked: true, indent: 1 }], 'done', 4), 'Enter');
  expect(docToBlocks(s.doc)).toEqual([
    { type: 'todo', runs: [r('done')], checked: true, indent: 1 },
    { type: 'todo', runs: [], checked: false, indent: 1 },
  ]);
  expect(docToBlocks(press(s, 'Enter').doc)[1]).toEqual({
    type: 'p',
    runs: [],
  });
});

test('Backspace at a line start outdents, then makes a paragraph; Tab indents within 0 to 6', () => {
  let s = at([{ type: 'ul', indent: 1, runs: [r('x')] }], 'x', 0);
  s = press(s, 'Backspace');
  expect(docToBlocks(s.doc)).toEqual([{ type: 'ul', runs: [r('x')] }]);
  expect(docToBlocks(press(s, 'Backspace').doc)).toEqual([p('x')]);
  let t = at([{ type: 'ul', indent: 6, runs: [r('x')] }], 'x', 0);
  t = press(t, 'Tab');
  expect(docToBlocks(t.doc)[0]).toMatchObject({ indent: 6 });
});

test('mounts a document and shows lists, checks and headings', () => {
  const { container } = render(<NoteEditor blocks={FIXTURES['every block type']!} onChange={() => undefined} />);
  expect(container.querySelector('[data-block="h1"]')?.textContent).toBe('Water cycle');
  expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
  expect((container.querySelectorAll('input[type="checkbox"]')[0] as HTMLInputElement).checked).toBe(true);
});
