import {
  baseKeymap,
  chainCommands,
  deleteSelection,
  joinBackward,
  selectNodeBackward,
  toggleMark,
} from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import { textblockTypeInputRule, inputRules } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import type { NodeType } from 'prosemirror-model';
import type { Command, Plugin } from 'prosemirror-state';
import { canSplit } from 'prosemirror-transform';
import { M, N } from './editorSchema.ts';

const MAX_INDENT = 6;
const isList = (t: NodeType) => t === N.bullet || t === N.ordered || t === N.todo;

/** Enter: an empty list item ends the list; a split todo starts unticked; a split heading starts a paragraph. */
const enter: Command = (state, dispatch) => {
  const { $from } = state.selection;
  const t = $from.parent.type;
  if (t === N.paragraph || !$from.parent.isTextblock) return false;
  if (isList(t) && !$from.parent.content.size && state.selection.empty) {
    dispatch?.(state.tr.setNodeMarkup($from.before(), N.paragraph).scrollIntoView());
    return true;
  }
  const tr = state.tr.deleteSelection();
  const at = tr.selection.from;
  const $at = tr.doc.resolve(at);
  const type = t === N.heading && $at.parentOffset === $at.parent.content.size ? N.paragraph : t;
  const attrs = type === N.paragraph ? null : { ...$from.parent.attrs, ...(t === N.todo ? { checked: false } : {}) };
  if (!canSplit(tr.doc, at, 1, [{ type, attrs }])) return false;
  dispatch?.(tr.split(at, 1, [{ type, attrs }]).scrollIntoView());
  return true;
};

/** Backspace at a line's start: outdent, then turn into a paragraph, then join upward (never across a column). */
const backspace: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset > 0 || !$from.parent.isTextblock) return false;
  const t = $from.parent.type;
  if (isList(t) && $from.parent.attrs.indent > 0) {
    dispatch?.(
      state.tr.setNodeMarkup($from.before(), t, {
        ...$from.parent.attrs,
        indent: $from.parent.attrs.indent - 1,
      }),
    );
    return true;
  }
  if (t !== N.paragraph) {
    dispatch?.(state.tr.setNodeMarkup($from.before(), N.paragraph));
    return true;
  }
  return false;
};

const shift =
  (by: 1 | -1): Command =>
  (state, dispatch) => {
    const { $from } = state.selection;
    const a = $from.parent.attrs;
    if (!isList($from.parent.type)) return false;
    const indent = Math.max(0, Math.min(MAX_INDENT, a.indent + by));
    if (indent !== a.indent) dispatch?.(state.tr.setNodeMarkup($from.before(), undefined, { ...a, indent }));
    return true;
  };

/** Plain text only: the sanitiser is the only way HTML becomes blocks, and the clipboard's markup is not used. */
export const pastePlain =
  (text: string): Command =>
  (state, dispatch) => {
    const t = text
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '');
    if (!t || !state.selection.$from.parent.isTextblock) return false;
    dispatch?.(state.tr.insertText(t.replace(/\n+/g, ' ')).scrollIntoView());
    return true;
  };

const rule = (re: RegExp, type: NodeType, attrs?: Record<string, unknown>) => textblockTypeInputRule(re, type, attrs);

export const editorPlugins = (): Plugin[] => [
  inputRules({
    rules: [
      rule(/^#\s$/, N.heading, { level: 1 }),
      rule(/^##\s$/, N.heading, { level: 2 }),
      rule(/^###\s$/, N.heading, { level: 3 }),
      rule(/^[-*]\s$/, N.bullet),
      rule(/^1\.\s$/, N.ordered),
      rule(/^\[\]\s$/, N.todo),
    ],
  }),
  keymap({
    Enter: enter,
    Backspace: chainCommands(backspace, deleteSelection, joinBackward, selectNodeBackward),
    Tab: shift(1),
    'Shift-Tab': shift(-1),
    'Mod-z': undo,
    'Mod-y': redo,
    'Shift-Mod-z': redo,
    'Mod-b': toggleMark(M.bold),
    'Mod-i': toggleMark(M.italic),
    'Mod-u': toggleMark(M.underline),
    'Shift-Mod-x': toggleMark(M.strike),
  }),
  keymap(baseKeymap),
];
