import type { ReactNode } from "react";
import { EditableTitle } from "./EditableTitle";

export interface PageProps {
  title: string;
  /** Makes the title edit in place: called with the new, non-empty name on blur or Enter. */
  onTitle?: (title: string) => void;
  /** Shown when an editable title is empty. */
  titlePlaceholder?: string;
  /** Focus and select the editable title on mount: for an item that was just made. */
  focusTitle?: boolean;
  /** The type glyph before the title, drawn by the caller. */
  glyph?: ReactNode;
  /** The one quiet line beside the title. */
  meta?: string;
  /** A way back, drawn by the caller (a kit Button of kind text). */
  crumb?: ReactNode;
  /** The page's actions, right-aligned; kit Buttons only. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** The one centred column of an area: title, one meta, optional crumb and actions, then the sections. */
export function Page({
  title,
  onTitle,
  titlePlaceholder,
  focusTitle,
  glyph,
  meta,
  crumb,
  actions,
  children,
}: PageProps) {
  return (
    <div className="kit-page" data-ui="page">
      <div className="kit-page-top">
        {crumb ? <div className="kit-crumb">{crumb}</div> : null}
        <div className="kit-head">
          {glyph ? <span className="kit-head-glyph">{glyph}</span> : null}
          <h1 className="kit-head-title">
            {onTitle ? (
              <EditableTitle
                value={title}
                onRename={onTitle}
                placeholder={titlePlaceholder}
                autoFocus={focusTitle}
              />
            ) : (
              title
            )}
          </h1>
          {meta ? <span className="kit-head-meta">{meta}</span> : null}
          {actions ? <div className="kit-head-actions">{actions}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
