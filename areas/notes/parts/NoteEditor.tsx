import { useEffect, useRef } from 'react';
import { history } from 'prosemirror-history';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Block } from '../../../domain/index.ts';
import { blocksToDoc, docToBlocks } from './editorDoc.ts';
import { editorPlugins, pastePlain } from './editorKeys.ts';
import { limitPlugin, unwrapPlugin } from './editorLimits.ts';
import { blocksFromHtml, pasteBlocks } from './editorPaste.ts';
import { schema } from './editorSchema.ts';

export interface NoteEditorProps {
  blocks: readonly Block[];
  /** The whole block list after an edit; the caller saves it through the outbox. */
  onChange: (blocks: Block[]) => void;
}

const SAVE_AFTER_MS = 600;
const json = (b: readonly Block[]) => JSON.stringify(b);

const start = (blocks: readonly Block[]) =>
  EditorState.create({
    doc: blocksToDoc(blocks),
    plugins: [history(), limitPlugin(), unwrapPlugin(), ...editorPlugins()],
  });

/**
 * The note editor (D-464): ProseMirror on the flat schema of spike S-08. Blocks go in through ev4's normaliser and come
 * out through it, so a note that is opened and not changed saves byte-identical. Edits are sent after a short pause,
 * and at once when the editor loses focus or goes away.
 */
export function NoteEditor({ blocks, onChange }: NoteEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sent = useRef(json(blocks));
  const emit = useRef(onChange);
  emit.current = onChange;

  const flush = () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    if (!view.current) return;
    const out = docToBlocks(view.current.state.doc);
    if (json(out) === sent.current) return;
    sent.current = json(out);
    emit.current(out);
  };

  useEffect(() => {
    const v = new EditorView(host.current!, {
      state: start(blocks),
      attributes: {
        'aria-label': 'Note',
        role: 'textbox',
        'aria-multiline': 'true',
      },
      handlePaste: (vw, e) => {
        const html = blocksFromHtml(e.clipboardData?.getData('text/html') ?? '');
        if (html) return pasteBlocks(html)(vw.state, vw.dispatch);
        const text = e.clipboardData?.getData('text/plain') ?? '';
        return pastePlain(text)(vw.state, vw.dispatch);
      },
      handleDOMEvents: { blur: () => (flush(), false) },
      nodeViews: {
        todo: (node, vw, getPos) => {
          const dom = document.createElement('div');
          dom.className = 'ev-notes-li';
          dom.dataset.block = 'todo';
          const box = document.createElement('input');
          box.type = 'checkbox';
          box.ariaLabel = 'Done';
          box.contentEditable = 'false';
          box.addEventListener('change', () => {
            const at = getPos();
            if (at === undefined) return;
            const a = vw.state.doc.nodeAt(at)!.attrs;
            vw.dispatch(
              vw.state.tr.setNodeMarkup(at, undefined, {
                ...a,
                checked: !a.checked,
              }),
            );
          });
          const contentDOM = document.createElement('span');
          dom.append(box, contentDOM);
          const paint = (n: typeof node) => {
            box.checked = !!n.attrs.checked;
            dom.dataset.done = String(!!n.attrs.checked);
            dom.style.paddingLeft = `calc(var(--sp-6) * ${n.attrs.indent})`;
          };
          paint(node);
          return {
            dom,
            contentDOM,
            update: (n) => (n.type !== schema.nodes.todo ? false : (paint(n), true)),
          };
        },
      },
      dispatchTransaction(tr) {
        const next = v.state.apply(tr);
        v.updateState(next);
        if (!tr.docChanged) return;
        if (pending.current) clearTimeout(pending.current);
        pending.current = setTimeout(flush, SAVE_AFTER_MS);
      },
    });
    view.current = v;
    return () => {
      flush();
      v.destroy();
      view.current = null;
    };
  }, []);

  // A change that did not come from this editor (another tab, a restored version) replaces the document.
  useEffect(() => {
    const v = view.current;
    if (!v || pending.current || json(blocks) === sent.current) return;
    if (json(docToBlocks(blocksToDoc(blocks))) === sent.current) return;
    sent.current = json(docToBlocks(blocksToDoc(blocks)));
    v.updateState(start(blocks));
  }, [blocks]);

  return <div className="ev-notes-doc ev-notes-edit" data-ui="note-editor" ref={host} />;
}
