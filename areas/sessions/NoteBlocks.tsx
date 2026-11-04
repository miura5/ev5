import { useEffect, useState, type ReactNode } from "react";
import { api, readToken } from "../../commands/client.ts";
import { Choice } from "../../kit/index.ts";
import { IMG_KEY, type Note } from "../../domain/index.ts";

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

/** A stored note picture, fetched with the app token (the Worker keeps it owner-only, §data.note-images); the word Image only until it loads or when it can't. */
function Picture({ k, alt }: { k?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!k || !IMG_KEY.test(k)) return;
    let live = true;
    api(k, readToken())
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
      .catch(() => null)
      .then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [k]);
  if (url)
    return <img className="ev-session-pic" src={url} alt={alt ?? "Picture"} />;
  return <p className="ev-session-meta">{alt ? `Image · ${alt}` : "Image"}</p>;
}

function one(
  b: Block,
  k: number,
  onToggle?: (index: number) => void,
): ReactNode {
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
        <div className="ev-session-todo" style={pad}>
          <Choice
            kind="checkbox"
            checked={!!b.checked}
            disabled={!onToggle}
            onChange={() => onToggle?.(k)}
          >
            {runs(b)}
          </Choice>
        </div>
      );
    case "img":
      return <Picture k={b.key} alt={b.alt} />;
    default:
      return <p>{runs(b)}</p>;
  }
}

/** A note's blocks on the session page; its todo blocks are the session's checks. */
export function NoteBlocks({
  blocks,
  onToggle,
}: {
  blocks: readonly Block[];
  /** Flips a todo block by its index in the note; absent leaves the checks read-only. */
  onToggle?: (index: number) => void;
}) {
  return (
    <div data-ui="note-blocks">
      {blocks.map((b, k) => (
        <div key={b.key ?? k}>{one(b, k, onToggle)}</div>
      ))}
    </div>
  );
}
