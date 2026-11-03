// S-08 spike: a ProseMirror schema shaped like ev4's blocks. One node type per ev4 block type, list items kept FLAT
// with an indent attribute (as ev4 stores them), and a two-column row as row > column > blocks (as ev4 paints it).
import { Schema, type NodeSpec, type MarkSpec } from 'prosemirror-model';


export const nodes: Record<string, NodeSpec> = {
  doc: { content: '(block | row)+' },
  paragraph: { group: 'block', content: 'text*', marks: '_' },
  heading: { group: 'block', content: 'text*', marks: '_', attrs: { level: { default: 1 } } },
  bullet: { group: 'block', content: 'text*', marks: '_', attrs: { indent: { default: 0 } } },
  ordered: { group: 'block', content: 'text*', marks: '_', attrs: { indent: { default: 0 } } },
  todo: { group: 'block', content: 'text*', marks: '_', attrs: { indent: { default: 0 }, checked: { default: false } } },
  image: {
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    attrs: { key: {}, width: { default: null }, alt: { default: null } },
  },
  row: { content: 'column column', attrs: { id: {} }, isolating: true },
  column: { content: 'block+', isolating: true },
  text: {},
};

export const marks: Record<string, MarkSpec> = {
  // ev4 runs have no order between marks; ProseMirror sorts them by this rank, which is harmless (keys, not order)
  link: { attrs: { href: {} }, inclusive: false },
  bold: {},
  italic: {},
  underline: {},
  strike: {},
};

export const schema = new Schema({ nodes, marks });
