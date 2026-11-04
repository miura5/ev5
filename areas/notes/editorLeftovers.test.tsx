import { EditorState, TextSelection } from 'prosemirror-state';
import { expect, test } from 'vitest';
import type { Block, Run } from '../../domain/index.ts';
import { blocksToDoc, docToBlocks } from './parts/editorDoc.ts';
import { limitPlugin, unwrapPlugin } from './parts/editorLimits.ts';
import { blocksFromHtml, pasteBlocks } from './parts/editorPaste.ts';

// The S-08 leftovers (docs/spikes/S-08-notes-editor.md): the noteFits refusals, a row unwrapped once a column is empty,
// and ev4's HTML paste sanitiser. The expectations are ev4's own (test/notes-editor.test.mjs).
const r = (text: string, m: Omit<Run, 'text'> = {}): Run => ({ text, ...m });
const p = (text: string): Block => ({ type: 'p', runs: [r(text)] });
const KEY = 'note-images/abcdEFGH12345678.png';

const make = (blocks: Block[], refused: string[] = []) =>
  EditorState.create({
    doc: blocksToDoc(blocks),
    plugins: [limitPlugin((w) => refused.push(w)), unwrapPlugin()],
  });
const endOf = (s: EditorState, text: string) => {
  let pos = 0;
  s.doc.descendants((n, at) => {
    if (n.isText && n.text === text) pos = at + text.length;
  });
  return s.apply(s.tr.setSelection(TextSelection.create(s.doc, pos)));
};

test("noteFits: a 4,001st line is refused whole, in Matt's words, and the note stays as it was", () => {
  const why: string[] = [];
  const full = Array.from({ length: 4000 }, (_, i) => p('line ' + i));
  const s = endOf(make(full, why), 'line 3999');
  const split = s.tr.split(s.selection.from);
  const out = s.applyTransaction(split).state;
  expect(out.doc.eq(s.doc)).toBe(true);
  expect(why).toEqual(['A note holds up to 4,000 lines. Start a new note for the rest.']);
  // typing still works at the limit
  expect(docToBlocks(s.apply(s.tr.insertText('!')).doc)[3999]).toEqual(p('line 3999!'));
});

test('noteFits: a 5,000-line paste is refused whole; a note already past the limit may shrink', () => {
  const why: string[] = [];
  const s = make([p('before')], why);
  const pasted = Array.from({ length: 5000 }, (_, i) => p('line ' + i));
  const before = endOf(s, 'before');
  let tr = before.tr;
  pasteBlocks(pasted)(before, (t) => (tr = t));
  const out = before.applyTransaction(tr);
  expect(out.state.doc.eq(before.doc)).toBe(true);
  expect(why.at(-1)).toMatch(/4,000 lines/);

  const over = make(Array.from({ length: 4002 }, (_, i) => p('l' + i)));
  const cut = over.tr.delete(0, over.doc.child(0).nodeSize);
  expect(over.applyTransaction(cut).state.doc.childCount).toBe(4001);
  expect(over.applyTransaction(over.tr.split(over.doc.child(0).nodeSize - 1)).state.doc.childCount).toBe(4002);
});

test('noteFits: a line of 401 formatting runs is refused, not folded; 400 is fine', () => {
  const why: string[] = [];
  const runs = Array.from({ length: 400 }, (_, i) => r('ab', i % 2 ? { b: true } : {}));
  const s = make([{ type: 'p', runs }], why);
  expect(docToBlocks(s.doc)[0]!.runs).toHaveLength(400);
  const mid = s.tr.addMark(2, 3, s.schema.marks.italic!.create());
  expect(s.applyTransaction(mid).state.doc.eq(s.doc)).toBe(true);
  expect(why.at(-1)).toMatch(/400 changes of formatting/);
});

test('a row is unwrapped once a column is empty; the other column goes full width, nothing lost', () => {
  const cell = (b: Block, col: 0 | 1): Block => ({ ...b, row: 'r1', col });
  const blocks = [
    p('before'),
    cell({ type: 'img', runs: [], key: KEY, width: 300 }, 0),
    cell(p('beside'), 1),
    cell({ type: 'h2', runs: [r('head')] }, 1),
    p('after'),
  ];
  const s = make(blocks);
  let pic = 0;
  s.doc.descendants((n, at) => {
    if (n.type.name === 'image') pic = at;
  });
  // deleting the picture leaves ProseMirror to fill its column with an empty paragraph; the row then unwraps
  const next = s.apply(s.tr.delete(pic, pic + 1));
  expect(docToBlocks(next.doc)).toEqual([p('before'), p('beside'), { type: 'h2', runs: [r('head')] }, p('after')]);
  // a row with both columns kept is left alone
  expect(docToBlocks(s.apply(s.tr.insertText('x', 1)).doc).filter((b) => b.row)).toHaveLength(3);
});

const HTML =
  '<html><head><style>p{color:red}</style><title>x</title><script>alert(1)</script></head><body>' +
  '<!--StartFragment--><h1 onclick="alert(2)">Heading</h1>' +
  '<p>Plain <b>bold</b> <span style="font-style:italic;text-decoration:underline">styled</span>' +
  '<script>document.cookie</script><img src=x onerror="alert(3)"><iframe src="https://evil.example"></iframe>' +
  '<a href="javascript:alert(4)">bad link</a> <a href="https://ok.example/x">good link</a></p>' +
  '<ul><li>one<li>two<ul><li>deeper</li></ul></ul><ol><li>first</li></ol>' +
  '<ul class="contains-task-list"><li><input type="checkbox" checked> ticked</li></ul>' +
  '<h5>Small &amp; tidy &lt;b&gt;</h5><table><tr><td>a</td><td>b</td></tr></table>' +
  '<svg><text>svg text</text></svg><template><p>hidden</p></template><!--EndFragment--></body></html>';

test('paste sanitiser: text, blocks, lists and marks only; no HTML or script gets through', () => {
  const blocks = blocksFromHtml(HTML)!;
  expect(blocks).toEqual([
    { type: 'h1', runs: [r('Heading')] },
    {
      type: 'p',
      runs: [
        r('Plain '),
        r('bold', { b: true }),
        r(' '),
        r('styled', { i: true, u: true }),
        r('bad link '),
        r('good link', { href: 'https://ok.example/x' }),
      ],
    },
    { type: 'ul', runs: [r('one')] },
    { type: 'ul', runs: [r('two')] },
    { type: 'ul', indent: 1, runs: [r('deeper')] },
    { type: 'ol', runs: [r('first')] },
    { type: 'todo', checked: true, runs: [r('ticked')] },
    { type: 'h3', runs: [r('Small & tidy <b>')] },
    { type: 'p', runs: [r('ab')] },
  ]);
  const all = JSON.stringify(blocks);
  for (const bad of [
    'alert',
    'script',
    'cookie',
    'onerror',
    'iframe',
    'evil',
    'javascript',
    'svg text',
    'hidden',
    'color:red',
  ])
    expect(all).not.toContain(bad);
});

test('paste sanitiser: an unclosed script swallows the rest; a Docs wrapper is not bold; oversize or empty gives way', () => {
  expect(blocksFromHtml('<p>ok</p><script>alert(1)')).toEqual([p('ok')]);
  expect(blocksFromHtml('<b style="font-weight:normal"><span>plain</span></b>')).toEqual([p('plain')]);
  expect(blocksFromHtml('plain text only')).toBeNull();
  expect(blocksFromHtml('<p>' + 'a'.repeat(2000001) + '</p>')).toBeNull();
  expect(blocksFromHtml('<script>x</script><p> </p>')).toBeNull();
});

test('paste sanitiser: a paragraph of 450 formatted spans keeps all its text, split into lines of at most 400 runs', () => {
  const spans = Array.from({ length: 450 }, (_, i) => (i % 2 ? '<b>w' + i + ' </b>' : '<i>w' + i + ' </i>')).join('');
  const want = Array.from({ length: 450 }, (_, i) => 'w' + i + ' ')
    .join('')
    .trimEnd();
  const blocks = blocksFromHtml('<p>' + spans + '</p>')!;
  expect(blocks.map((b) => b.runs.map((x) => x.text).join('')).join('')).toBe(want);
  expect(blocks.length).toBeGreaterThanOrEqual(2);
  expect(blocks.every((b) => b.runs.length <= 400)).toBe(true);
});

test('pasted blocks land at the caret: the first joins the line, the rest follow it', () => {
  const s = make([p('hello world')]);
  const at = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 6)));
  let out = at;
  pasteBlocks(blocksFromHtml('<p>one</p><h2>two</h2>')!)(at, (t) => (out = at.apply(t)));
  expect(docToBlocks(out.doc)).toEqual([p('helloone'), { type: 'h2', runs: [r('two world')] }]);
});
