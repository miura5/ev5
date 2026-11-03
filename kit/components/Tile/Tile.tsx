import type { ReactNode } from "react";

export interface TileProps {
  title: string;
  meta?: string;
  /** The one value, top right. */
  value?: string;
  /** The type glyph, drawn by the caller. */
  glyph?: ReactNode;
  onOpen?: () => void;
}

/** A set in the Library: glyph and value on top, title, one quiet meta. No tint, no cover. */
export function Tile({ title, meta, value, glyph, onOpen }: TileProps) {
  return (
    <button type="button" className="kit-tile" data-ui="tile" onClick={onOpen}>
      <span className="kit-tile-top">
        {glyph}
        {value ? <span className="kit-tile-meta">{value}</span> : null}
      </span>
      <span className="kit-tile-title">{title}</span>
      {meta ? <span className="kit-tile-meta">{meta}</span> : null}
    </button>
  );
}
