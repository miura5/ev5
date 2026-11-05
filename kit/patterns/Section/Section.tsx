import type { ReactNode } from "react";
import { Button } from "../../components/Button/Button";

export interface SectionProps {
  label: string;
  /** A quiet count or note beside the label. */
  count?: string;
  /** The add action's label; it shows on hover or focus. */
  addLabel?: string;
  onAdd?: () => void;
  children?: ReactNode;
}

/** A labelled block of a page; the add action stays hidden until the section is hovered or focused. */
export function Section({ label, count, addLabel = "Add", onAdd, children }: SectionProps) {
  return (
    <section className="kit-sec" data-ui="section" aria-label={label}>
      <div className="kit-sec-head">
        <h2 className="kit-sec-label">{label}</h2>
        {count ? <span className="kit-sec-count">{count}</span> : null}
        {onAdd ? (
          <span className="kit-sec-add">
            <Button kind="text" onClick={onAdd}>
              {addLabel}
            </Button>
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
