import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  key: string;
  label: string;
  /** The key that does the same thing. */
  hint?: string;
  /** A picker's current choice. */
  checked?: boolean;
  danger?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  onPick: (key: string) => void;
  onClose: () => void;
  label: string;
}

/** Item actions and every picker: arrows move, Enter picks, Esc closes. */
export function Menu({ items, onPick, onClose, label }: MenuProps) {
  const [at, setAt] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const last = items.length - 1;
  return (
    <div
      ref={ref}
      className="kit-menu"
      data-ui="menu"
      role="menu"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === "ArrowDown") setAt(at >= last ? 0 : at + 1);
        else if (e.key === "ArrowUp") setAt(at <= 0 ? last : at - 1);
        else if (e.key === "Enter" && items[at]) onPick(items[at].key);
        else return;
        e.preventDefault();
      }}
    >
      {items.map((it, i) => (
        <div
          key={it.key}
          role={it.checked === undefined ? "menuitem" : "menuitemradio"}
          aria-checked={it.checked}
          className={`kit-menu-item${i === at ? " kit-menu-on" : ""}${it.danger ? " kit-menu-bad" : ""}`}
          onMouseEnter={() => setAt(i)}
          onClick={() => onPick(it.key)}
        >
          <span className="kit-menu-check" aria-hidden="true">
            {it.checked ? "✓" : ""}
          </span>
          <span className="kit-menu-label">{it.label}</span>
          {it.hint ? <kbd className="kit-kbd">{it.hint}</kbd> : null}
        </div>
      ))}
    </div>
  );
}
