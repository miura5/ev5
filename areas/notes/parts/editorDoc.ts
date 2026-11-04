import type { Mark, Node as PMNode } from 'prosemirror-model';
import type { Block } from '../../../domain/index.ts';
import { M, N, schema } from './editorSchema.ts';

type Run = Block['runs'][number];
const TEXT_CAP = 20000; // ev4's longest run (spec S-08: ProseMirror joins neighbours, so export splits again)

const inline = (runs: readonly Run[]): PMNode[] =>
  runs
    .filter((r) => r.text)
    .map((r) => {
      const ms: Mark[] = [];
      if (r.b) ms.push(M.bold.create());
      if (r.i) ms.push(M.italic.create());
      if (r.u) ms.push(M.underline.create());
      if (r.s) ms.push(M.strike.create());
      if (r.href) ms.push(M.link.create({ href: r.href }));
      return schema.text(r.text, ms);
    });

function node(b: Block): PMNode {
  const indent = b.indent ?? 0;
  switch (b.type) {
    case 'h1':
    case 'h2':
    case 'h3':
      return N.heading.create({ level: Number(b.type[1]) }, inline(b.runs));
    case 'ul':
      return N.bullet.create({ indent }, inline(b.runs));
    case 'ol':
      return N.ordered.create({ indent }, inline(b.runs));
    case 'todo':
      return N.todo.create({ indent, checked: !!b.checked }, inline(b.runs));
    case 'img':
      return N.image.create({
        key: b.key,
        width: b.width ?? null,
        alt: b.alt ?? null,
      });
    default:
      return N.paragraph.create(null, inline(b.runs));
  }
}

/** Stored blocks into a doc. Stored notes are already in ev4's normal form; a row short of a column is laid flat. */
export function blocksToDoc(blocks: readonly Block[]): PMNode {
  const list = blocks;
  const top: PMNode[] = [];
  for (let i = 0; i < list.length; ) {
    const b = list[i]!;
    if (!b.row) {
      top.push(node(b));
      i++;
      continue;
    }
    const cols: PMNode[][] = [[], []];
    while (i < list.length && list[i]!.row === b.row) {
      const x = list[i++]!;
      cols[x.col ?? 0]!.push(node(x));
    }
    if (!cols[0]!.length || !cols[1]!.length) top.push(...cols.flat());
    else
      top.push(
        N.row.create(
          { id: b.row },
          cols.map((c) => N.column.create(null, c)),
        ),
      );
  }
  return N.doc.create(null, top.length ? top : [N.paragraph.create()]);
}

function runsOf(block: PMNode): Run[] {
  const runs: Run[] = [];
  block.forEach((t) => {
    const r: Run = { text: t.text ?? '' };
    for (const m of t.marks) {
      if (m.type === M.bold) r.b = true;
      else if (m.type === M.italic) r.i = true;
      else if (m.type === M.underline) r.u = true;
      else if (m.type === M.strike) r.s = true;
      else if (m.type === M.link) r.href = m.attrs.href;
    }
    runs.push(r);
  });
  return runs;
}

function blockOf(n: PMNode, place: Pick<Block, 'row' | 'col'>): Block {
  const a = n.attrs;
  const b: Block =
    n.type === N.heading
      ? { type: `h${a.level}` as Block['type'], runs: runsOf(n) }
      : n.type === N.bullet || n.type === N.ordered || n.type === N.todo
        ? {
            type: n.type === N.bullet ? 'ul' : n.type === N.ordered ? 'ol' : 'todo',
            runs: runsOf(n),
            ...(n.type === N.todo ? { checked: !!a.checked } : {}),
            ...(a.indent ? { indent: a.indent } : {}),
          }
        : n.type === N.image
          ? {
              type: 'img',
              runs: [],
              key: a.key,
              ...(a.width != null ? { width: a.width } : {}),
              ...(a.alt != null ? { alt: a.alt } : {}),
            }
          : { type: 'p', runs: runsOf(n) };
  return Object.assign(b, place);
}

/** ev4's key order and run cap; JSON.stringify of a note is what it stores, hashes and compares (S-08 causes 1, 2). */
const ev4Run = (r: Run): Run => ({
  text: r.text,
  ...(r.b ? { b: true as const } : {}),
  ...(r.i ? { i: true as const } : {}),
  ...(r.u ? { u: true as const } : {}),
  ...(r.s ? { s: true as const } : {}),
  ...(r.href !== undefined ? { href: r.href } : {}),
});

function ev4Block(b: Block): Block {
  const runs = b.runs.flatMap((r) =>
    Array.from({ length: Math.max(1, Math.ceil(r.text.length / TEXT_CAP)) }, (_, k) =>
      ev4Run({ ...r, text: r.text.slice(k * TEXT_CAP, (k + 1) * TEXT_CAP) }),
    ),
  );
  const o: Block = { type: b.type, runs };
  if (b.type === 'img') Object.assign(o, { key: b.key, width: b.width, alt: b.alt });
  else Object.assign(o, { checked: b.checked, indent: b.indent });
  Object.assign(o, { row: b.row, col: b.col });
  for (const k of Object.keys(o) as (keyof Block)[]) if (o[k] === undefined) delete o[k];
  return o;
}

/** A doc back into blocks in ev4's stored shape. */
export function docToBlocks(doc: PMNode): Block[] {
  const out: Block[] = [];
  doc.forEach((top) => {
    if (top.type === N.row) {
      top.forEach((col, _o, ci) => col.forEach((b) => out.push(blockOf(b, { row: top.attrs.id, col: ci as 0 | 1 }))));
    } else out.push(blockOf(top, {}));
  });
  return out.map(ev4Block);
}
