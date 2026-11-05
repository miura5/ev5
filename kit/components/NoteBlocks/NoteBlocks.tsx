import type { ReactNode } from "react";
import { Choice } from "../Field/Field";

/** One inline run: text with its marks. */
export interface NoteRunShape {
  text: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean;
  href?: string;
}

/**
 * A note block as the renderer reads it. The type is a plain string here: the list of block types lives once, in
 * domain/note (§ui.kit-leads); a type this does not know draws as a paragraph.
 */
export interface NoteBlockShape {
  type: string;
  runs: readonly NoteRunShape[];
  indent?: number;
  checked?: boolean;
  alt?: string;
  key?: string;
  row?: string;
  col?: number;
}

export interface NoteBlocksProps {
  blocks: readonly NoteBlockShape[];
  /** The page title above; a leading heading that repeats it is left out so it shows once. */
  title?: string;
  /** Flips a to-do by its index in `blocks`; absent leaves the checks read-only. */
  onToggle?: (index: number) => void;
  /** Draws a picture block; absent shows the word Image with its description. */
  renderImage?: (block: NoteBlockShape) => ReactNode;
}

const norm = (t: string) => t.replace(/\s+/g, " ").trim();

function Runs({ runs }: { runs: readonly NoteRunShape[] }) {
  return (
    <>
      {runs.map((r, k) => {
        let n: ReactNode = r.text;
        if (r.b) n = <b>{n}</b>;
        if (r.i) n = <i>{n}</i>;
        if (r.u) n = <u>{n}</u>;
        if (r.s) n = <s>{n}</s>;
        if (r.href) n = <a href={r.href}>{n}</a>;
        return <span key={k}>{n}</span>;
      })}
    </>
  );
}

const pad = (b: NoteBlockShape) => ({
  paddingLeft: `calc(var(--sp-6) * ${b.indent ?? 0})`,
});

function One({
  b,
  index,
  onToggle,
  renderImage,
}: {
  b: NoteBlockShape;
  index: number;
  onToggle?: (index: number) => void;
  renderImage?: (block: NoteBlockShape) => ReactNode;
}) {
  switch (b.type) {
    case "h1":
      return (
        <h2 className="kit-note-title" data-block="h1">
          <Runs runs={b.runs} />
        </h2>
      );
    case "h2":
      return (
        <h3 data-block="h2">
          <Runs runs={b.runs} />
        </h3>
      );
    case "h3":
      return (
        <h4 data-block="h3">
          <Runs runs={b.runs} />
        </h4>
      );
    case "img":
      return (
        <figure className="kit-note-pic" data-block="img">
          {renderImage ? (
            renderImage(b)
          ) : (
            <span>{b.alt ? `Image · ${b.alt}` : "Image"}</span>
          )}
        </figure>
      );
    case "todo":
      return (
        <div
          className="kit-note-li"
          data-block="todo"
          data-done={b.checked ? "true" : "false"}
          style={pad(b)}
        >
          {onToggle ? (
            <Choice
              kind="checkbox"
              checked={!!b.checked}
              onChange={() => onToggle(index)}
            >
              <Runs runs={b.runs} />
            </Choice>
          ) : (
            <>
              <Choice
                kind="checkbox"
                checked={!!b.checked}
                readOnly
                aria-label="Done"
              />
              <span>
                <Runs runs={b.runs} />
              </span>
            </>
          )}
        </div>
      );
    case "ul":
    case "ol":
      return (
        <div className="kit-note-li" data-block={b.type} style={pad(b)}>
          <span aria-hidden="true">{b.type === "ul" ? "•" : "–"}</span>
          <span>
            <Runs runs={b.runs} />
          </span>
        </div>
      );
    default:
      return (
        <p data-block="p">
          <Runs runs={b.runs} />
        </p>
      );
  }
}

/** The one note renderer: notes and study sessions both draw a note's blocks here; a two-column row puts a picture beside text. */
export function NoteBlocks({
  blocks,
  title,
  onToggle,
  renderImage,
}: NoteBlocksProps) {
  const first = blocks[0];
  const skip =
    title !== undefined &&
    first?.type === "h1" &&
    norm(first.runs.map((r) => r.text).join("")) === norm(title)
      ? 0
      : -1;
  const draw = (b: NoteBlockShape, k: number) => (
    <One
      b={b}
      index={k}
      onToggle={onToggle}
      renderImage={renderImage}
      key={k}
    />
  );
  const out: ReactNode[] = [];
  const seen = new Set<string>();
  blocks.forEach((b, k) => {
    if (k === skip) return;
    if (!b.row) {
      out.push(draw(b, k));
      return;
    }
    if (seen.has(b.row)) return;
    seen.add(b.row);
    const mine = blocks
      .map((c, j) => [c, j] as const)
      .filter(([c, j]) => c.row === b.row && j !== skip);
    out.push(
      <div className="kit-note-cols" data-block="row" key={`row-${b.row}`}>
        {[0, 1].map((col) => (
          <div className="kit-note-col" key={col}>
            {mine
              .filter(([c]) => (c.col === 1 ? 1 : 0) === col)
              .map(([c, j]) => draw(c, j))}
          </div>
        ))}
      </div>,
    );
  });
  return (
    <div className="kit-note" data-ui="note-body">
      {out}
    </div>
  );
}
