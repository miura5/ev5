import type { Node as PMNode } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { docToBlocks } from './editorDoc.ts';
import { fits } from '../../../domain/index.ts';
import { N } from './editorSchema.ts';

const maxRuns = (bs: readonly { runs: readonly unknown[] }[]) => bs.reduce((m, b) => Math.max(m, b.runs.length), 0);

/**
 * The 4,000-line and 400-run limits (S-08, noteFits): a change that would take a note past either is refused whole and
 * the note stays as it was; nothing is cut. A note already past a limit may still shrink or stay the same.
 * `onRefuse` hears the reason in Matt's words.
 */
export const limitPlugin = (onRefuse?: (why: string) => void) =>
  new Plugin({
    filterTransaction(tr, state) {
      if (!tr.docChanged) return true;
      const next = docToBlocks(tr.doc);
      const why = fits(next);
      if (!why) return true;
      const now = docToBlocks(state.doc);
      if (next.length <= now.length && maxRuns(next) <= maxRuns(now)) return true;
      onRefuse?.(why);
      return false;
    },
  });

/** ev4's rule: a row with a column left empty goes full width, the other column's lines kept (S-08 cause 5). */
export const unwrapPlugin = () =>
  new Plugin({
    appendTransaction(trs, _old, state) {
      if (!trs.some((t) => t.docChanged)) return null;
      const found: { at: number; size: number; keep: PMNode }[] = [];
      state.doc.forEach((top, at) => {
        if (top.type !== N.row) return;
        const empty = (c: PMNode) =>
          c.childCount === 1 && c.firstChild!.type === N.paragraph && c.firstChild!.content.size === 0;
        const [a, b] = [top.child(0), top.child(1)];
        if (empty(a) || empty(b)) found.push({ at, size: top.nodeSize, keep: empty(a) ? b : a });
      });
      if (!found.length) return null;
      const tr = state.tr;
      for (const f of found.reverse()) tr.replaceWith(f.at, f.at + f.size, f.keep.content);
      return tr;
    },
  });
