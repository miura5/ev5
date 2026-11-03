// S-08 spike, for comparison only: Tiptap's STOCK extensions (StarterKit, TaskList/TaskItem nested, Image), where a
// list is a nested tree (bulletList > listItem > paragraph, bulletList ...) instead of ev4's flat items with indent.
// Two-column rows still need custom nodes (Tiptap has none). Measures what the nested shape loses.
import { Node, getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import Image from '@tiptap/extension-image';
import { Node as PMNode } from 'prosemirror-model';
import type { Block, Run } from './model.ts';

export const stockSchema = getSchema([
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Image,
  Node.create({ name: 'noteRow', group: 'block', content: 'noteColumn noteColumn', addAttributes: () => ({ id: { default: null } }) }),
  Node.create({ name: 'noteColumn', content: 'block+' }),
]);

type J = { type: string; attrs?: Record<string, unknown>; content?: J[]; text?: string; marks?: J[] };
const LIST = { ul: 'bulletList', ol: 'orderedList', todo: 'taskList' } as const;

const inline = (runs: Run[]): J[] =>
  runs
    .filter(r => r.text)
    .map(r => {
      const marks: J[] = [];
      if (r.b) marks.push({ type: 'bold' });
      if (r.i) marks.push({ type: 'italic' });
      if (r.u) marks.push({ type: 'underline' });
      if (r.s) marks.push({ type: 'strike' });
      if (r.href) marks.push({ type: 'link', attrs: { href: r.href } });
      return { type: 'text', text: r.text, ...(marks.length ? { marks } : {}) };
    });
const para = (runs: Run[]): J => ({ type: 'paragraph', content: inline(runs) });

/** One block sequence (top level or one column) as stock JSON; consecutive list items become nested lists. */
function seq(blocks: Block[], gaps: { n: number }): J[] {
  const out: J[] = [];
  // stack[d] = the open list at depth d and the content array it sits in
  let stack: { list: J; kind: string }[] = [];
  for (const b of blocks) {
    if (!(b.type in LIST)) {
      stack = [];
      if (b.type === 'p') out.push(para(b.runs));
      else if (b.type === 'img')
        out.push({ type: 'image', attrs: { src: b.key, width: b.width ?? null, alt: b.alt ?? null } });
      else out.push({ type: 'heading', attrs: { level: Number(b.type[1]) }, content: inline(b.runs) });
      continue;
    }
    const kind = LIST[b.type as keyof typeof LIST];
    const d = b.indent || 0;
    stack.length = Math.min(stack.length, d + 1);
    const item = (): J => ({
      type: kind === 'taskList' ? 'taskItem' : 'listItem',
      ...(kind === 'taskList' ? { attrs: { checked: !!b.checked } } : {}),
      content: [para(b.runs)],
    });
    const attach = (l: J, k: number) => {
      if (k === 0) out.push(l);
      else {
        const parent = stack[k - 1].list.content!;
        parent[parent.length - 1].content!.push(l);
      }
    };
    // an indented item hangs from the last item one level up; a jump of more than one level has none, so an empty
    // item is made for it (the export then holds a line ev4 never had: lossy)
    for (let k = stack.length; k < d; k++) {
      gaps.n++;
      const filler: J = { type: kind === 'taskList' ? 'taskItem' : 'listItem', content: [{ type: 'paragraph' }] };
      if (kind === 'taskList') filler.attrs = { checked: false };
      const l: J = { type: kind, content: [filler] };
      attach(l, k);
      stack.push({ list: l, kind });
    }
    if (stack.length === d + 1 && stack[d].kind !== kind) stack.length = d; // another kind: a sibling list
    if (stack.length === d) {
      const l: J = { type: kind, content: [] };
      attach(l, d);
      stack.push({ list: l, kind });
    }
    stack[d].list.content!.push(item());
  }
  return out;
}

export function stockFromBlocks(blocks: Block[]): { doc: PMNode; gaps: number } {
  const gaps = { n: 0 };
  const top: J[] = [];
  for (let i = 0; i < blocks.length; ) {
    const b = blocks[i];
    if (!b.row) {
      let j = i;
      while (j < blocks.length && !blocks[j].row) j++;
      top.push(...seq(blocks.slice(i, j), gaps));
      i = j;
      continue;
    }
    const cols: Block[][] = [[], []];
    while (i < blocks.length && blocks[i].row === b.row) cols[blocks[i].col ?? 0].push(blocks[i++]);
    top.push({ type: 'noteRow', attrs: { id: b.row }, content: cols.map(c => ({ type: 'noteColumn', content: seq(c, gaps) })) });
  }
  const doc = PMNode.fromJSON(stockSchema, { type: 'doc', content: top });
  doc.check();
  return { doc, gaps: gaps.n };
}

const runsOf = (n: PMNode): Run[] => {
  const runs: Run[] = [];
  n.forEach(t => {
    const r: Run = { text: t.text || '' };
    for (const m of t.marks) {
      if (m.type.name === 'bold') r.b = true;
      else if (m.type.name === 'italic') r.i = true;
      else if (m.type.name === 'underline') r.u = true;
      else if (m.type.name === 'strike') r.s = true;
      else if (m.type.name === 'link') r.href = m.attrs.href;
    }
    runs.push(r);
  });
  return runs;
};

function walk(n: PMNode, out: Block[], depth: number, place: Pick<Block, 'row' | 'col'>) {
  const name = n.type.name;
  if (name === 'paragraph') out.push({ type: 'p', runs: runsOf(n), ...place });
  else if (name === 'heading') out.push({ type: ('h' + n.attrs.level) as Block['type'], runs: runsOf(n), ...place });
  else if (name === 'image') {
    const b: Block = { type: 'img', runs: [], key: n.attrs.src, ...place };
    if (n.attrs.width != null) b.width = n.attrs.width;
    if (n.attrs.alt != null) b.alt = n.attrs.alt;
    out.push(b);
  } else if (name === 'bulletList' || name === 'orderedList' || name === 'taskList') {
    const type = name === 'bulletList' ? 'ul' : name === 'orderedList' ? 'ol' : 'todo';
    n.forEach(item => {
      item.forEach((child, _o, k) => {
        if (k === 0) {
          const b: Block = { type, runs: runsOf(child) };
          if (type === 'todo') b.checked = !!item.attrs.checked;
          if (depth) b.indent = depth;
          out.push(Object.assign(b, place));
        } else walk(child, out, depth + 1, place); // a second paragraph in an item has no ev4 shape: it comes out as p
      });
    });
  } else if (name === 'noteRow') n.forEach((col, _o, ci) => col.forEach(c => walk(c, out, 0, { row: n.attrs.id, col: ci as 0 | 1 })));
  else throw new Error('no ev4 block for ' + name);
}
export function stockToBlocks(doc: PMNode): Block[] {
  const out: Block[] = [];
  doc.forEach(n => walk(n, out, 0, {}));
  return out;
}
