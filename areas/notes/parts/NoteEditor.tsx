import { useState } from "react";
import type { Block } from "../../../domain/index.ts";

const text = (b: Block) => b.runs.map((r) => r.text).join("");

export interface NoteEditorProps {
  blocks: readonly Block[];
  /** The whole block list after an edit; the caller saves it through the outbox. */
  onChange: (blocks: Block[]) => void;
}

/**
 * Block editing without a rich-text dependency: one textarea per block. A block whose words change becomes one plain
 * run (its marks go); untouched blocks keep theirs. Enter starts a new paragraph, Backspace on an empty block removes it.
 */
export function NoteEditor({ blocks, onChange }: NoteEditorProps) {
  const [draft, setDraft] = useState<Record<number, string>>({});
  const commit = (i: number) => {
    const d = draft[i];
    setDraft(({ [i]: _gone, ...rest }) => rest);
    const b = blocks[i];
    if (d === undefined || !b || d === text(b)) return;
    onChange(
      blocks.map((x, k) =>
        k === i ? { ...x, runs: d ? [{ text: d }] : [] } : x,
      ),
    );
  };
  const insertAfter = (i: number) =>
    onChange([
      ...blocks.slice(0, i + 1),
      { type: "p", runs: [] },
      ...blocks.slice(i + 1),
    ]);
  return (
    <div className="ev-notes-doc ev-notes-edit" data-ui="note-editor">
      {blocks.map((b, i) =>
        b.type === "img" ? (
          <figure className="ev-notes-pic" key={i} data-block="img">
            <span>{b.alt ? `Image · ${b.alt}` : "Image"}</span>
          </figure>
        ) : (
          <div className="ev-notes-editline" key={i} data-block={b.type}>
            {b.type === "todo" ? (
              <input
                type="checkbox"
                checked={!!b.checked}
                aria-label="Done"
                onChange={() =>
                  onChange(
                    blocks.map((x, k) =>
                      k === i ? { ...x, checked: !x.checked } : x,
                    ),
                  )
                }
              />
            ) : null}
            <textarea
              aria-label={`Block ${i + 1}`}
              rows={1}
              value={draft[i] ?? text(b)}
              onChange={(e) => setDraft({ ...draft, [i]: e.target.value })}
              onBlur={() => commit(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit(i);
                  insertAfter(i);
                } else if (
                  e.key === "Backspace" &&
                  (draft[i] ?? text(b)) === "" &&
                  blocks.length > 1
                ) {
                  e.preventDefault();
                  onChange(blocks.filter((_, k) => k !== i));
                }
              }}
            />
          </div>
        ),
      )}
      <button
        type="button"
        className="ev-notes-addblock"
        onClick={() => insertAfter(blocks.length - 1)}
      >
        Add paragraph
      </button>
    </div>
  );
}
