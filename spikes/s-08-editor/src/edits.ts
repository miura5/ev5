// S-08 spike: a few of ev4's editing behaviours done as ProseMirror transactions on the direct schema, exported, and
// compared with the blocks ev4's own tests expect. This is a sample, not a port of the editor: it shows the model's
// edits land on the same blocks, and where a translated command is needed.
import { isDeepStrictEqual } from 'node:util';
import { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from './schema.ts';
import { blocksToDoc, exportBlocks, DIRECT } from './convert.ts';
import { noteBlocks, type Block } from './model.ts';

const r = (text: string, m = {}) => ({ text, ...m });
const KEY = 'note-images/abcdEFGH12345678.png';
const load = (blocks: Block[]) => EditorState.create({ doc: blocksToDoc(schema, DIRECT, blocks) });
const out = (doc: PMNode) => exportBlocks(DIRECT, doc);
/** The doc position of character `o` of top-level block `i` (blocks outside rows). */
const at = (doc: PMNode, i: number, o: number) => {
  let pos = 0;
  for (let k = 0; k < i; k++) pos += doc.child(k).nodeSize;
  return pos + 1 + o;
};

export interface EditResult {
  name: string;
  from: string;
  ok: boolean;
  note: string;
}

export function runEdits(): EditResult[] {
  const res: EditResult[] = [];
  const check = (name: string, from: string, fn: () => [unknown, unknown, string?]) => {
    try {
      const [got, want, note] = fn();
      res.push({ name, from, ok: isDeepStrictEqual(got, want), note: note || (isDeepStrictEqual(got, want) ? '' : JSON.stringify(got).slice(0, 200)) });
    } catch (e) {
      res.push({ name, from, ok: false, note: 'threw: ' + (e as Error).message.slice(0, 160) });
    }
  };
  const two = noteBlocks([{ type: 'p', runs: [r('hello world')] }, { type: 'p', runs: [r('second')] }]);

  check('bold on across two lines, then off', 'notes-editor.test noteSetMark', () => {
    const s = load(two);
    const from = at(s.doc, 0, 6), to = at(s.doc, 1, 3);
    const on = s.apply(s.tr.addMark(from, to, schema.marks.bold.create()));
    const off = on.apply(on.tr.removeMark(from, to, schema.marks.bold));
    const want = [{ type: 'p', runs: [r('hello '), r('world', { b: true })] }, { type: 'p', runs: [r('sec', { b: true }), r('ond')] }];
    return [[out(on.doc), out(off.doc)], [want, two]];
  });

  check('Enter inside a marked list item continues the list', 'notes-editor.test Enter', () => {
    const s = load(noteBlocks([{ type: 'ul', runs: [r('ab', { b: true }), r('cd')] }]));
    const t = s.apply(s.tr.split(at(s.doc, 0, 1)));
    return [out(t.doc), [{ type: 'ul', runs: [r('a', { b: true })] }, { type: 'ul', runs: [r('b', { b: true }), r('cd')] }]];
  });

  check('Enter in a ticked checklist item: the new item is unticked', 'notes-editor.test Enter in todo', () => {
    const s = load(noteBlocks([{ type: 'todo', checked: true, runs: [r('x')] }]));
    // a plain split copies the attributes (checked: true); ev4's rule needs the type and attrs given for the new item
    const plain = out(s.apply(s.tr.split(at(s.doc, 0, 1))).doc)[1];
    const rule = s.apply(s.tr.split(at(s.doc, 0, 1), 1, [{ type: schema.nodes.todo, attrs: { indent: 0, checked: false } }]));
    return [out(rule.doc)[1], { type: 'todo', runs: [], checked: false }, `plain split gives ${JSON.stringify(plain)}; ev4's rule needs typesAfter`];
  });

  check('tick, indent and type change through setNodeMarkup', 'B-402 noteIndent / noteSetType', () => {
    const s = load(noteBlocks([{ type: 'todo', checked: false, runs: [r('t')] }, { type: 'ul', runs: [r('u')] }]));
    let tr = s.tr.setNodeMarkup(0, null, { indent: 0, checked: true });
    tr = tr.setNodeMarkup(tr.doc.child(0).nodeSize, null, { indent: 2 });
    tr = tr.setNodeMarkup(0, schema.nodes.heading, { level: 2 });
    return [out(tr.doc), [{ type: 'h2', runs: [r('t')] }, { type: 'ul', runs: [r('u')], indent: 2 }]];
  });

  check('picture resized and moved under the heading', 'note-images.test resize/move', () => {
    const img = { type: 'img' as const, runs: [], key: KEY, width: 480, alt: 'heart diagram' };
    const s = load(noteBlocks([{ type: 'h1', runs: [r('Heart')] }, { type: 'p', runs: [r('Four chambers.')] }, img]));
    const imgPos = s.doc.child(0).nodeSize + s.doc.child(1).nodeSize;
    let tr = s.tr.setNodeMarkup(imgPos, null, { ...s.doc.child(2).attrs, width: 300 });
    const node = tr.doc.nodeAt(imgPos)!;
    tr = tr.delete(imgPos, imgPos + node.nodeSize).insert(s.doc.child(0).nodeSize, node);
    return [out(tr.doc).map(b => b.type + (b.width ? b.width : '')), ['h1', 'img300', 'p']];
  });

  check('Enter in a column keeps the new line in the column', 'note-images.test B-654 Enter in column', () => {
    const blocks = noteBlocks([
      { type: 'h1', runs: [r('Heart')] },
      { type: 'p', runs: [r('Four chambers.')], row: 'r1', col: 0 },
      { type: 'img', runs: [], key: KEY, row: 'r1', col: 1 },
    ]);
    const s = load(blocks);
    // inside row (h1 size) > column (+1) > paragraph (+1) > text
    const p0 = s.doc.child(0).nodeSize + 1 + 1 + 1 + 14;
    const t = s.apply(s.tr.split(p0));
    return [out(t.doc).map(b => [b.type, b.row || '', b.col ?? '']), [['h1', '', ''], ['p', 'r1', 0], ['p', 'r1', 0], ['img', 'r1', 1]]];
  });

  check('picture deleted out of its row: the text goes full width', 'note-images.test B-654 noteRemoveImage', () => {
    const blocks = noteBlocks([
      { type: 'p', runs: [r('Four chambers.')], row: 'r1', col: 0 },
      { type: 'img', runs: [], key: KEY, row: 'r1', col: 1 },
    ]);
    const s = load(blocks);
    const col1 = 1 + s.doc.child(0).child(0).nodeSize; // inside the row, at column 1
    const tr = s.tr.delete(col1 + 1, col1 + 1 + 1); // the picture, an atom of size 1
    const raw = out(tr.doc);
    // ProseMirror keeps the column valid ("block+") by filling it with an empty paragraph: no text lost, but the row
    // stays; ev4's rule (a one-column row goes full width) needs a translated command that unwraps the row
    const got = noteBlocks(raw).map(b => b.row || 'full');
    return [got, ['full'], `got ${JSON.stringify(got)}, raw ${JSON.stringify(raw)}`];
  });

  return res;
}
