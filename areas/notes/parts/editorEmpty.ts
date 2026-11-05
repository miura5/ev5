import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const EMPTY_LINE = "Start writing, or type # for a heading";

/** A decoration only, so the line is drawn by CSS and never enters the document or the saved blocks. */
export const emptyPlugin = () =>
  new Plugin({
    props: {
      decorations(state) {
        const { doc } = state;
        if (doc.childCount !== 1 || doc.firstChild!.content.size > 0)
          return null;
        return DecorationSet.create(doc, [
          Decoration.node(0, doc.firstChild!.nodeSize, {
            class: "ev-notes-empty",
            "data-placeholder": EMPTY_LINE,
          }),
        ]);
      },
    },
  });
