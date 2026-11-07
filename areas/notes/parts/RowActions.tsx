import { useRef, useState, type ReactNode } from "react";
import { Button, Menu, Palette, type MenuItem } from "../../../kit/index.ts";

export type RowAction = "open" | "pin" | "delete";

export interface MoveTarget {
  id: string;
  title: string;
  /** The parent collection, so a child is listed under it. */
  parentId?: string | null;
}

/** The picker's rows: collections by name, each child directly under its parent, the current one marked. */
export function moveItems(
  targets: readonly MoveTarget[],
  current: string | null,
) {
  const ids = new Set(targets.map((t) => t.id));
  const out: {
    key: string;
    label: string;
    indent: number;
    current: boolean;
  }[] = [];
  const walk = (parent: string | null, depth: number, seen: Set<string>) => {
    for (const t of targets) {
      const p = t.parentId && ids.has(t.parentId) ? t.parentId : null;
      if (p !== parent || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push({
        key: t.id,
        label: t.title,
        indent: depth,
        current: t.id === current,
      });
      walk(t.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  return out;
}

export interface RowActionsProps {
  /** What the menu is about, for its label: a note title. */
  title: string;
  /** The row (or bar) the menu belongs to. A function places the dots itself (the note page puts them at the end of
   * its meta line, as the mock-up does); otherwise the dots follow the row. */
  children: ReactNode | ((dots: ReactNode) => ReactNode);
  onAction?: (action: RowAction) => void;
  /** The collections Move can pick; Move is left out when there is no onMove. */
  targets?: readonly MoveTarget[];
  /** The collection the item is in now, shown checked in the picker. */
  current?: string | null;
  onMove?: (collectionId: string) => void;
  className?: string;
  /** Menu entries to leave out, e.g. Open on the note's own page. */
  omit?: readonly RowAction[];
}

/** The row menu: Open, Pin, Move, Delete from the dots, a right-click, or the . key on the focused row. */
export function RowActions({
  title,
  children,
  onAction,
  targets = [],
  current = null,
  onMove,
  className = "ev-notes-line",
  omit = [],
}: RowActionsProps) {
  const [moving, setMoving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const all: MenuItem[] = [
    { key: "open", label: "Open" },
    { key: "pin", label: "Pin" },
    ...(onMove ? [{ key: "move", label: "Move…" }] : []),
    { key: "delete", label: "Delete", danger: true },
  ];
  const items = all.filter((i) => !omit.includes(i.key as RowAction));
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
            {typeof children === "function" ? (
              children(onAction ? dots : null)
            ) : (
              <>
                {children}
                {onAction ? dots : null}
              </>
            )}
          </div>
        }
      />
      {moving ? (
        <Palette
          ask={false}
          label={`Move ${title} to`}
          placeholder="Move to a collection"
          groups={[{ name: "Move to", items: moveItems(targets, current) }]}
          onRun={(id) => {
            setMoving(false);
            if (id !== current) onMove?.(id);
          }}
          onClose={() => setMoving(false)}
        />
      ) : null}
    </>
  );
}
