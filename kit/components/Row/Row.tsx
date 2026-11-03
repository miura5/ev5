import type { ReactNode } from "react";

export interface RowProps {
  title: string;
  /** One quiet line under the title. */
  meta?: string;
  /** The one right-aligned value. */
  value?: string;
  /** The type glyph, drawn by the caller. */
  glyph?: ReactNode;
  selected?: boolean;
  onOpen?: () => void;
}

/** One line of a list: glyph, title, one meta, one value. */
export function Row({ title, meta, value, glyph, selected, onOpen }: RowProps) {
  return (
    <div
      className={selected ? "kit-row kit-row-sel" : "kit-row"}
      data-ui="row"
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {glyph}
      <div className="kit-row-text">
        <div className="kit-row-title">{title}</div>
        {meta ? <span className="kit-row-meta">{meta}</span> : null}
      </div>
      {value ? <span className="kit-row-value">{value}</span> : null}
    </div>
  );
}
