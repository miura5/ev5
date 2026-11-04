import type { ReactNode } from "react";
import { Button } from "../Button/Button";
import { Menu, type MenuProps } from "../Menu/Menu";

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
  /** The ⋯ menu: its button opens these actions (items passed in, drawn by the kit Menu). */
  more?: Pick<MenuProps, "items" | "onPick" | "onClose">;
  onClose?: () => void;
  children?: ReactNode;
}

/** The side panel for any item: title, properties edited in place, its main action, ⋯. */
export function Detail({
  title,
  properties,
  primary,
  more,
  onClose,
  children,
}: DetailProps) {
  return (
    <aside className="kit-detail" data-ui="detail" aria-label="Detail">
      <div className="kit-detail-head">
        <h2 className="kit-detail-title">{title}</h2>
        {more ? (
          <Menu
            {...more}
            label="More"
            trigger={
              <Button kind="icon" aria-label="More">
                ⋯
              </Button>
            }
          />
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
