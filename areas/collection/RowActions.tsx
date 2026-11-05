import { useRef, useState, type ReactNode } from "react";
import { Button, Menu, type MenuItem } from "../../kit/index.ts";

type Action = "open" | "pin" | "unpin" | "delete";

/** The row menu: Open, Pin, Move, Delete from the dots, a right-click, or the . key on the focused row. */
export function RowActions({
  title,
  entry,
  pinned,
  targets,
  children,
  onAction,
  onMove,
}: {
  title: string;
  entry: string;
  pinned: boolean;
  targets: readonly { id: string; title: string }[];
  children: ReactNode;
  onAction: (action: Action) => void;
  onMove?: (collectionId: string) => void;
}) {
  const [moving, setMoving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const label = `Actions for ${title}`;
  const items: MenuItem[] = [
    { key: "open", label: "Open" },
    pinned ? { key: "unpin", label: "Unpin" } : { key: "pin", label: "Pin" },
    ...(onMove ? [{ key: "move", label: "Move…" }] : []),
    { key: "delete", label: "Delete", danger: true },
  ];
  const pick = (k: string) =>
    k === "move" ? setMoving(true) : onAction(k as Action);
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
            className="ev-coll-entry"
            data-entry={entry}
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
          </div>
        }
      />
      {moving ? (
        <div
          className="ev-coll-move"
          role="dialog"
          aria-label={`Move ${title} to`}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMoving(false);
          }}
        >
          <span className="ev-coll-meta">Move to</span>
          {targets.map((c) => (
            <Button
              key={c.id}
              kind="text"
              onClick={() => {
                setMoving(false);
                onMove?.(c.id);
              }}
            >
              {c.title}
            </Button>
          ))}
          {targets.length === 0 ? (
            <span className="ev-coll-meta">No collections yet.</span>
          ) : null}
          <Button kind="text" onClick={() => setMoving(false)}>
            Cancel
          </Button>
        </div>
      ) : null}
    </>
  );
}
