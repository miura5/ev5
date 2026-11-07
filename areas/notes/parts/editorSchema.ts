import {
  Schema,
  type DOMOutputSpec,
  type MarkSpec,
  type MarkType,
  type NodeSpec,
  type NodeType,
} from 'prosemirror-model';

/** Spike S-08's flat schema: one node per block type, list items flat with an indent, a row as two columns. */
const line = (name: string): NodeSpec => ({
  group: 'block',
  content: 'text*',
  marks: '_',
  attrs: { indent: { default: 0 } },
  toDOM: (n): DOMOutputSpec => [
    'div',
    {
      class: 'ev-notes-li',
      'data-block': name,
      style: `padding-left: calc(var(--sp-6) * ${n.attrs.indent})`,
    },
    0,
  ],
});

const nodes: Record<string, NodeSpec> = {
  doc: { content: '(block | row)+' },
  paragraph: {
    group: 'block',
    content: 'text*',
    marks: '_',
    toDOM: () => ['p', { 'data-block': 'p' }, 0],
  },
  heading: {
    group: 'block',
    content: 'text*',
    marks: '_',
    attrs: { level: { default: 1 } },
    toDOM: (n): DOMOutputSpec => [
      `h${n.attrs.level + 1}`,
      {
        'data-block': `h${n.attrs.level}`,
        class: n.attrs.level === 1 ? 'ev-notes-h1' : undefined,
      },
      0,
    ],
  },
  bullet: line('ul'),
  ordered: line('ol'),
  // The checkbox comes from the node view in NoteEditor; this is the fallback rendering.
  todo: {
    ...line('todo'),
    attrs: { indent: { default: 0 }, checked: { default: false } },
  },
  image: {
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    attrs: { key: {}, width: { default: null }, alt: { default: null } },
    toDOM: (n): DOMOutputSpec => [
      'figure',
      { class: 'ev-notes-pic', 'data-block': 'img' },
      n.attrs.alt ? `Image · ${n.attrs.alt}` : 'Image',
    ],
  },
  row: {
    content: 'column column',
    attrs: { id: {} },
    isolating: true,
    toDOM: () => ['div', { class: 'ev-notes-cols' }, 0],
  },
  column: {
    content: 'block+',
    isolating: true,
    toDOM: () => ['div', { class: 'ev-notes-col' }, 0],
  },
  text: {},
};

const marks: Record<string, MarkSpec> = {
  link: {
    attrs: { href: {} },
    inclusive: false,
    toDOM: (m): DOMOutputSpec => ['a', { href: m.attrs.href }, 0],
  },
  bold: { toDOM: () => ['b', 0] },
  italic: { toDOM: () => ['i', 0] },
  underline: { toDOM: () => ['u', 0] },
  strike: { toDOM: () => ['s', 0] },
};

export const schema = new Schema({ nodes, marks });

const node = (n: string) => schema.nodes[n] as NodeType;
const mark = (n: string) => schema.marks[n] as MarkType;
/** The schema's node and mark types, by name. */
export const N = {
  doc: node('doc'),
  paragraph: node('paragraph'),
  heading: node('heading'),
  bullet: node('bullet'),
  ordered: node('ordered'),
  todo: node('todo'),
  image: node('image'),
  row: node('row'),
  column: node('column'),
};
export const M = {
  link: mark('link'),
  bold: mark('bold'),
  italic: mark('italic'),
  underline: mark('underline'),
  strike: mark('strike'),
};
