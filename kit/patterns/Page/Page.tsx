import type { ReactNode } from "react";

export interface PageProps {
  title: string;
  /** The one quiet line beside the title. */
  meta?: string;
  /** A way back, drawn by the caller (a kit Button of kind text). */
  crumb?: ReactNode;
  /** The page's actions, right-aligned; kit Buttons only. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** The one centred column of an area: title, one meta, optional crumb and actions, then the sections. */
export function Page({ title, meta, crumb, actions, children }: PageProps) {
  return (
    <div className="kit-page" data-ui="page">
      <div className="kit-page-top">
        {crumb ? <div className="kit-crumb">{crumb}</div> : null}
        <div className="kit-head">
          <h1 className="kit-head-title">{title}</h1>
          {meta ? <span className="kit-head-meta">{meta}</span> : null}
          {actions ? <div className="kit-head-actions">{actions}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
