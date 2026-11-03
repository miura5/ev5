// S-08 spike: the same shape as src/schema.ts, built as Tiptap extensions (Node.create / Mark.create) and turned into
// a ProseMirror schema with getSchema, headless. Names follow Tiptap's stock extensions where one exists.
import { Node, Mark, getSchema } from '@tiptap/core';
import type { Names } from './convert.ts';

const textBlock = (name: string, attrs: Record<string, { default: unknown }> = {}) =>
  Node.create({
    name,
    group: 'block',
    content: 'text*',
    marks: '_',
    addAttributes: () => attrs,
  });

export const extensions = [
  Node.create({ name: 'doc', topNode: true, content: '(block | noteRow)+' }),
  Node.create({ name: 'text', group: 'inline' }),
  textBlock('paragraph'),
  textBlock('heading', { level: { default: 1 } }),
  textBlock('noteBullet', { indent: { default: 0 } }),
  textBlock('noteOrdered', { indent: { default: 0 } }),
  textBlock('noteTodo', { indent: { default: 0 }, checked: { default: false } }),
  Node.create({
    name: 'image',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes: () => ({ key: { default: null }, width: { default: null }, alt: { default: null } }),
  }),
  Node.create({ name: 'noteRow', content: 'noteColumn noteColumn', isolating: true, addAttributes: () => ({ id: { default: null } }) }),
  Node.create({ name: 'noteColumn', content: 'block+', isolating: true }),
  Mark.create({ name: 'link', inclusive: false, addAttributes: () => ({ href: { default: null } }) }),
  Mark.create({ name: 'bold' }),
  Mark.create({ name: 'italic' }),
  Mark.create({ name: 'underline' }),
  Mark.create({ name: 'strike' }),
];

export const tiptapSchema = getSchema(extensions);
export const TIPTAP: Names = {
  paragraph: 'paragraph',
  heading: 'heading',
  bullet: 'noteBullet',
  ordered: 'noteOrdered',
  todo: 'noteTodo',
  image: 'image',
  row: 'noteRow',
  column: 'noteColumn',
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strike',
  link: 'link',
};
