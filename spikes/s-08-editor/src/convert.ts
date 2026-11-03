// S-08 spike: ev4 blocks <-> a ProseMirror doc. Export is RAW (a direct mapping, no ev4 normaliser), so the test can
// see what the editor itself changes; `exportBlocks` adds the translated rules a lossless round trip needs.
import type { Node as PMNode, Schema, Mark as PMMark } from 'prosemirror-model';
import type { Block, Run } from './model.ts';
import { MAX } from './model.ts';

/** Node and mark names in the target schema (the direct schema and the Tiptap one name them differently). */
export interface Names {
  paragraph: string;
  heading: string;
  bullet: string;
  ordered: string;
  todo: string;
  image: string;
  row: string;
  column: string;
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  link: string;
}
export const DIRECT: Names = {
  paragraph: 'paragraph',
  heading: 'heading',
  bullet: 'bullet',
  ordered: 'ordered',
  todo: 'todo',
  image: 'image',
  row: 'row',
  column: 'column',
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strike',
  link: 'link',
};

function runsToInline(schema: Schema, n: Names, runs: Run[]): PMNode[] {
  const out: PMNode[] = [];
  for (const r of runs) {
    // ProseMirror refuses empty text nodes; ev4's normaliser never stores one, so this only skips non-normal input
    if (!r.text) continue;
    const ms: PMMark[] = [];
    if (r.b) ms.push(schema.marks[n.bold].create());
    if (r.i) ms.push(schema.marks[n.italic].create());
    if (r.u) ms.push(schema.marks[n.underline].create());
    if (r.s) ms.push(schema.marks[n.strike].create());
    if (r.href) ms.push(schema.marks[n.link].create({ href: r.href }));
    out.push(schema.text(r.text, ms));
  }
  return out;
}

function blockToNode(schema: Schema, n: Names, b: Block): PMNode {
  const inline = () => runsToInline(schema, n, b.runs);
  switch (b.type) {
    case 'p':
      return schema.nodes[n.paragraph].create(null, inline());
    case 'h1':
    case 'h2':
    case 'h3':
      return schema.nodes[n.heading].create({ level: Number(b.type[1]) }, inline());
    case 'ul':
      return schema.nodes[n.bullet].create({ indent: b.indent || 0 }, inline());
    case 'ol':
      return schema.nodes[n.ordered].create({ indent: b.indent || 0 }, inline());
    case 'todo':
      return schema.nodes[n.todo].create({ indent: b.indent || 0, checked: !!b.checked }, inline());
    case 'img':
      return schema.nodes[n.image].create({ key: b.key, width: b.width ?? null, alt: b.alt ?? null });
  }
}

/** Blocks into a doc: a run of blocks with the same row id becomes one row of two columns. */
export function blocksToDoc(schema: Schema, n: Names, blocks: Block[]): PMNode {
  const top: PMNode[] = [];
  for (let i = 0; i < blocks.length; ) {
    const b = blocks[i];
    if (!b.row) {
      top.push(blockToNode(schema, n, b));
      i++;
      continue;
    }
    const cols: PMNode[][] = [[], []];
    while (i < blocks.length && blocks[i].row === b.row) {
      const x = blocks[i++];
      cols[x.col ?? 0].push(blockToNode(schema, n, x));
    }
    // ev4's normaliser guarantees both columns are filled; an empty one cannot be built (content "block+")
    top.push(
      schema.nodes[n.row].create(
        { id: b.row },
        cols.map(c => schema.nodes[n.column].create(null, c))
      )
    );
  }
  const doc = schema.topNodeType.create(null, top);
  doc.check();
  return doc;
}

function inlineToRuns(n: Names, node: PMNode): Run[] {
  const runs: Run[] = [];
  node.forEach(t => {
    const r: Run = { text: t.text || '' };
    for (const m of t.marks) {
      if (m.type.name === n.bold) r.b = true;
      else if (m.type.name === n.italic) r.i = true;
      else if (m.type.name === n.underline) r.u = true;
      else if (m.type.name === n.strike) r.s = true;
      else if (m.type.name === n.link) r.href = m.attrs.href;
      // any other mark (an editor-only one) has no ev4 field and is dropped: ev4's schema refuses unknown run fields
    }
    runs.push(r);
  });
  return runs;
}

function nodeToBlock(n: Names, node: PMNode, place: Pick<Block, 'row' | 'col'>): Block {
  const name = node.type.name;
  let b: Block;
  if (name === n.paragraph) b = { type: 'p', runs: inlineToRuns(n, node) };
  else if (name === n.heading) b = { type: ('h' + node.attrs.level) as Block['type'], runs: inlineToRuns(n, node) };
  else if (name === n.bullet || name === n.ordered || name === n.todo) {
    b = { type: name === n.bullet ? 'ul' : name === n.ordered ? 'ol' : 'todo', runs: inlineToRuns(n, node) };
    if (name === n.todo) b.checked = !!node.attrs.checked;
    if (node.attrs.indent) b.indent = node.attrs.indent;
  } else if (name === n.image) {
    b = { type: 'img', runs: [], key: node.attrs.key };
    if (node.attrs.width != null) b.width = node.attrs.width;
    if (node.attrs.alt != null) b.alt = node.attrs.alt;
  } else throw new Error('no ev4 block for node ' + name);
  return Object.assign(b, place);
}

/** A doc back into blocks, raw: exactly what the tree holds, rows flattened column 0 first. */
export function docToBlocks(n: Names, doc: PMNode): Block[] {
  const out: Block[] = [];
  doc.forEach(top => {
    if (top.type.name === n.row) {
      top.forEach((col, _o, ci) => col.forEach(b => out.push(nodeToBlock(n, b, { row: top.attrs.id, col: ci as 0 | 1 }))));
    } else out.push(nodeToBlock(n, top, {}));
  });
  return out;
}

/**
 * The translated export rule the raw export lacks: ProseMirror joins neighbouring text with the same marks into one
 * text node, so a run ev4 split at its 20,000-character cap comes back joined. Splitting again at the cap restores it.
 */
export function capRuns(blocks: Block[]): Block[] {
  return blocks.map(b => {
    if (!b.runs.some(r => r.text.length > MAX.text)) return b;
    const runs: Run[] = [];
    for (const r of b.runs) for (let i = 0; i < r.text.length; i += MAX.text) runs.push({ ...r, text: r.text.slice(i, i + MAX.text) });
    return { ...b, runs };
  });
}

/**
 * The second translated export rule: ev4's key order. ev4 stores JSON.stringify of the document (pwa/runapi.js
 * canonicalText) and compares blocks by JSON.stringify (pwa/bridge.js sameWords), so key order is part of the data.
 * ProseMirror lists a text node's marks in schema rank, not ev4's order, so the run keys are rebuilt in ev4's order:
 * run {text, b, i, u, s, href}; block {type, runs, checked, indent, row, col}; picture {type, runs, key, width, alt, row, col}.
 */
export function ev4Order(blocks: Block[]): Block[] {
  return blocks.map(b => {
    const runs = b.runs.map(r => {
      const o: Run = { text: r.text };
      if (r.b) o.b = true;
      if (r.i) o.i = true;
      if (r.u) o.u = true;
      if (r.s) o.s = true;
      if (r.href !== undefined) o.href = r.href;
      return o;
    });
    const o: Block = { type: b.type, runs };
    if (b.type === 'img') {
      o.key = b.key;
      if (b.width !== undefined) o.width = b.width;
      if (b.alt !== undefined) o.alt = b.alt;
    } else {
      if (b.checked !== undefined) o.checked = b.checked;
      if (b.indent !== undefined) o.indent = b.indent;
    }
    if (b.row !== undefined) {
      o.row = b.row;
      o.col = b.col;
    }
    return o;
  });
}
export const exportBlocks = (n: Names, doc: PMNode) => ev4Order(capRuns(docToBlocks(n, doc)));
