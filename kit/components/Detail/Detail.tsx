import type { ReactNode } from "react";
import { Button } from "../Button/Button";

export interface DetailProperty {
  label: string;
  value: string;
  /** Present: the value edits in place. */
  onChange?: (value: string) => void;
}

export interface DetailProps {
  title: string;
  properties: DetailProperty[];
  /** The one main action; when present it leads the screen. */
  primary?: { label: string; hint?: string; onRun: () => void };
  /** The ⋯ menu button: opens the item's actions, drawn by the caller. */
  onMore?: () => void;
  onClose?: () => void;
  children?: ReactNode;
}

/** The side panel for any item: title, properties edited in place, its main action, ⋯. */
export function Detail({
  title,
  properties,
  primary,
  onMore,
  onClose,
  children,
}: DetailProps) {
  return (
    <aside className="kit-detail" data-ui="detail" aria-label="Detail">
      <div className="kit-detail-head">
        <h2 className="kit-detail-title">{title}</h2>
        {onMore ? (
          <Button kind="icon" aria-label="More" onClick={onMore}>
            ⋯
          </Button>
        ) : null}
        {onClose ? (
          <Button kind="icon" aria-label="Close" onClick={onClose}>
            ×
          </Button>
        ) : null}
      </div>
      {primary ? (
        <Button kind="primary" hint={primary.hint} onClick={primary.onRun}>
          {primary.label}
        </Button>
      ) : null}
      <dl className="kit-detail-props">
        {properties.map((p) => (
          <div className="kit-detail-prop" key={p.label}>
            <dt>{p.label}</dt>
            <dd>
              {p.onChange ? (
                <input
                  className="kit-detail-input"
                  aria-label={p.label}
                  value={p.value}
                  onChange={(e) => p.onChange?.(e.target.value)}
                />
              ) : (
                p.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {children}
    </aside>
  );
}
