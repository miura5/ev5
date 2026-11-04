import type { Command } from 'prosemirror-state';
import { Fragment, Slice } from 'prosemirror-model';
import { noteBlocks, type Block, type Run } from '../../../domain/index.ts';
import { blocksToDoc } from './editorDoc.ts';
import { splitWide } from '../../../domain/index.ts';
import { BLOCK, HTML_MAX, parseHtml, type HNode } from './editorHtml.ts';

// ev4's paste sanitiser (core/notes.mjs noteFromTree with paste: true, notePaste): clipboard HTML is read for text, block
// breaks, lists and four marks, and nothing else. No HTML ever reaches the editor; ProseMirror's own parser is not used.
const SKIP = new Set(
  'script style template noscript iframe frame frameset object embed applet svg math canvas video audio img picture source track map area head title meta link base input select option optgroup textarea button dialog form noembed noframes xmp plaintext'.split(
    ' ',
  ),
);
type Marks = Omit<Run, 'text'>;
type Want = { type: Block['type']; indent?: number; checked?: boolean };
type List = { type: 'ul' | 'ol' | 'todo'; indent: number };

const attr = (n: HNode, k: string) => n.attrs[k] ?? null;
const isHref = (h: string) => h.length <= 2000 && /^https?:\/\/[^\s<>"]+$/.test(h);
const cls = (n: HNode) => ' ' + String(attr(n, 'class') ?? '') + ' ';

function elMarks(n: HNode, name: string, marks: Marks): Marks {
  const m = { ...marks };
  if (name === 'b' || name === 'strong') m.b = true;
  if (['i', 'em', 'cite', 'dfn'].includes(name)) m.i = true;
  if (name === 'u' || name === 'ins') m.u = true;
  if (['s', 'strike', 'del'].includes(name)) m.s = true;
  if (name === 'a') {
    const h = String(attr(n, 'href') ?? '').trim();
    if (isHref(h)) m.href = h;
  }
  const st = String(attr(n, 'style') ?? '').toLowerCase();
  const w = /font-weight\s*:\s*([a-z0-9]+)/.exec(st);
  if (w) {
    if (w[1] === 'bold' || w[1] === 'bolder' || Number(w[1]) >= 600) m.b = true;
    else delete m.b;
  }
  if (/font-style\s*:\s*italic/.test(st)) m.i = true;
  const dec = /text-decoration(?:-line)?\s*:\s*([^;]+)/.exec(st);
  if (dec && /underline/.test(dec[1]!)) m.u = true;
  if (dec && /line-through/.test(dec[1]!)) m.s = true;
  return m;
}

const isTodoItem = (n: HNode) => {
  if (attr(n, 'role') === 'checkbox' || / (todo|task-list-item|checklist) /i.test(cls(n))) return true;
  return n.childNodes
    .slice(0, 3)
    .some((k) => k.nodeType === 1 && k.nodeName === 'input' && String(attr(k, 'type')).toLowerCase() === 'checkbox');
};
const isChecked = (n: HNode): boolean =>
  attr(n, 'data-checked') === 'true' ||
  attr(n, 'aria-checked') === 'true' ||
  /(^|\s)(checked|done)(\s|$)/.test(cls(n)) ||
  n.childNodes.some((k) => k.nodeType === 1 && k.nodeName === 'input' && 'checked' in k.attrs);

/** A tree read into blocks; whitespace collapses as HTML's does, and a tag it does not know is read for its text. */
export function blocksFromTree(root: HNode): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  let want: Want = { type: 'p' };
  let lastSpace = true;
  const open = (): Block => {
    if (!cur) {
      cur = {
        type: want.type,
        runs: [],
        ...(want.checked != null ? { checked: want.checked } : {}),
      };
      if (want.indent) cur.indent = want.indent;
      out.push(cur);
      lastSpace = true;
    }
    return cur;
  };
  const text = (n: HNode, marks: Marks) => {
    let s = (n.nodeValue ?? '').replace(/[\t\n\r\f ]+/g, ' ');
    if (lastSpace || !cur) s = s.replace(/^ /, '');
    if (!s) return;
    const c = s.replace(/[​-‍⁠﻿]/g, '').replace(/[\u0000-\u001f\u007f]/g, '');
    if (!c) return;
    open().runs.push({ text: c, ...marks });
    lastSpace = c.endsWith(' ');
  };
  const block = (w: Want, fn: () => void) => {
    const keep = want;
    cur = null;
    want = w;
    fn();
    cur = null;
    want = keep;
  };
  const walk = (n: HNode, marks: Marks, list: List | null) => n.childNodes.forEach((k) => visit(k, marks, list));
  function visit(n: HNode, marks: Marks, list: List | null) {
    if (n.nodeType === 3) return text(n, marks);
    const name = n.nodeName;
    if (SKIP.has(name) || attr(n, 'data-nb-skip') != null || attr(n, 'aria-hidden') === 'true') return;
    if (name === 'br') {
      cur = null;
      return;
    }
    if (name === 'ul' || name === 'ol') {
      const todoList = /(^|\s)(todo|contains-task-list|checklist)(\s|$)/.test(cls(n));
      const l: List = {
        type: name === 'ol' ? 'ol' : todoList ? 'todo' : 'ul',
        indent: list ? list.indent + 1 : 0,
      };
      return block(want, () => walk(n, marks, l));
    }
    if (name === 'li') {
      const type = isTodoItem(n) ? 'todo' : (list?.type ?? 'ul');
      const w: Want = {
        type,
        indent: Math.min(6, list?.indent ?? 0),
        ...(type === 'todo' ? { checked: isChecked(n) } : {}),
      };
      return block(w, () => walk(n, marks, list));
    }
    if (BLOCK.has(name)) {
      const h = /^h([1-6])$/.exec(name);
      return block(
        {
          type: h ? (('h' + Math.min(3, Number(h[1]))) as Block['type']) : 'p',
        },
        () => walk(n, h ? {} : marks, null),
      );
    }
    walk(n, elMarks(n, name, marks), list);
  }
  walk(root, {}, null);
  for (const b of out) {
    // HTML's whitespace at a block's end is not text (a meaningful one comes as &nbsp;)
    const last = b.runs[b.runs.length - 1];
    if (last) last.text = last.text.replace(/[\t\n\r\f ]+$/, '');
  }
  return noteBlocks(out);
}

/** What a paste brings from its HTML, sanitised, or null when there is nothing in it to keep (use the plain text). */
export function blocksFromHtml(html: string): Block[] | null {
  if (!html || html.length > HTML_MAX || !/<[a-z!]/i.test(html)) return null;
  const blocks = blocksFromTree(parseHtml(html));
  return blocks.some((b) => b.runs.some((r) => r.text.trim())) ? splitWide(blocks) : null;
}

/** Pasted blocks at the caret (the selection replaced): the first joins the line it lands in, the rest follow it. */
export const pasteBlocks =
  (blocks: Block[]): Command =>
  (state, dispatch) => {
    const flat = noteBlocks(blocks.map((b) => ({ ...b, row: undefined, col: undefined })));
    const doc = blocksToDoc(flat);
    if (!state.selection.$from.parent.isTextblock) return false;
    dispatch?.(state.tr.replaceSelection(new Slice(Fragment.from(doc.content), 1, 1)).scrollIntoView());
    return true;
  };
