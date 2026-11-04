import type { ReactNode } from "react";
import type { Note } from "../../domain/index.ts";

type Block = Note["blocks"][number];

function runs(b: Block): ReactNode {
  return b.runs.map((r, k) => {
    let n: ReactNode = r.text;
    if (r.b) n = <b>{n}</b>;
    if (r.i) n = <i>{n}</i>;
    if (r.u) n = <u>{n}</u>;
    if (r.s) n = <s>{n}</s>;
    if (r.href) n = <a href={r.href}>{n}</a>;
    return <span key={k}>{n}</span>;
  });
}

function one(b: Block): ReactNode {
  const pad = b.indent ? { paddingLeft: `${b.indent * 1.25}em` } : undefined;
  switch (b.type) {
    case "h1":
      return <h2>{runs(b)}</h2>;
    case "h2":
      return <h3>{runs(b)}</h3>;
    case "h3":
      return <h4>{runs(b)}</h4>;
    case "ul":
    case "ol":
      return (
        <p style={pad}>
          {b.type === "ul" ? "• " : ""}
          {runs(b)}
        </p>
      );
    case "todo":
      return (
        <p style={pad}>
          {b.checked ? "☑ " : "☐ "}
          {runs(b)}
        </p>
      );
    case "img":
      return (
        <p className="ev-session-meta">
          {b.alt ? `Image · ${b.alt}` : "Image"}
        </p>
      );
    default:
      return <p>{runs(b)}</p>;
  }
}

/** A note's blocks as plain read-only text on the session page. */
export function NoteBlocks({ blocks }: { blocks: readonly Block[] }) {
  return (
    <div data-ui="note-blocks">
      {blocks.map((b, k) => (
        <div key={b.key ?? k}>{one(b)}</div>
      ))}
    </div>
  );
}
