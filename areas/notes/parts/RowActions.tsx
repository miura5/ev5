import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button, Menu, type MenuItem } from "../../../kit/index.ts";

export type RowAction = "open" | "pin" | "delete";

export interface MoveTarget {
  id: string;
  title: string;
}

export interface RowActionsProps {
  /** What the menu is about, for its label: a note title. */
  title: string;
  /** The row (or bar) the menu belongs to. */
  children: ReactNode;
  onAction?: (action: RowAction) => void;
  /** The collections Move can pick; Move is left out when there is no onMove. */
  targets?: readonly MoveTarget[];
  /** The collection the item is in now, shown checked in the picker. */
  current?: string | null;
  onMove?: (collectionId: string) => void;
  style?: CSSProperties;
  className?: string;
}

/** The row menu: Open, Pin, Move, Delete from the dots, a right-click, or the . key on the focused row. */
export function RowActions({
  title,
  children,
  onAction,
  targets = [],
  current = null,
  onMove,
  style,
  className = "ev-notes-line",
}: RowActionsProps) {
  const [moving, setMoving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const items: MenuItem[] = [
    { key: "open", label: "Open" },
    { key: "pin", label: "Pin" },
    ...(onMove ? [{ key: "move", label: "Move…" }] : []),
    { key: "delete", label: "Delete", danger: true },
  ];
  const pick = (k: string) => {
    if (k === "move") setMoving(true);
    else onAction?.(k as RowAction);
  };
  const label = `Actions for ${title}`;
  const dots = (
    <Menu
      label={label}
      items={items}
      onPick={pick}
      trigger={
        <Button kind="text" aria-label={label}>
          ⋯
        </Button>
      }
    />
  );
  return (
    <>
      <Menu
        on="contextmenu"
        label={label}
        items={items}
        onPick={pick}
        trigger={
          <div
            ref={box}
            className={className}
            style={style}
            onKeyDown={(e) => {
              const t = e.target as HTMLElement;
              if (e.key !== "." || e.metaKey || e.ctrlKey || e.altKey) return;
              if (!e.currentTarget.contains(t)) return;
              if (t.closest("input,textarea,select,[contenteditable]")) return;
              e.preventDefault();
              // Radix opens its dropdown from the trigger's Enter key.
              box.current
                ?.querySelector<HTMLElement>(`button[aria-label="${label}"]`)
                ?.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
                );
            }}
          >
            {children}
            {onAction ? dots : null}
          </div>
        }
      />
      {moving ? (
        <div
          className="ev-notes-move"
          role="dialog"
          aria-label={`Move ${title} to`}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMoving(false);
          }}
        >
          <span className="ev-notes-meta">Move to</span>
          {targets.map((c) => (
            <Button
              key={c.id}
              kind="text"
              aria-pressed={c.id === current}
              onClick={() => {
                setMoving(false);
                if (c.id !== current) onMove?.(c.id);
              }}
            >
              {c.title}
            </Button>
          ))}
          {targets.length === 0 ? (
            <span className="ev-notes-meta">No collections yet.</span>
          ) : null}
          <Button kind="text" onClick={() => setMoving(false)}>
            Cancel
          </Button>
        </div>
      ) : null}
    </>
  );
}
