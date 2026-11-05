import { useRef } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Button } from "../Button/Button";
import { Dot, type DotTone } from "../Dot/Dot";
import { Menu, type MenuItem } from "../Menu/Menu";

export interface RowMenu {
  items: MenuItem[];
  onPick: (key: string) => void;
  label: string;
  /** Also shows a ⋯ button, named by `label`, that opens the same menu (reachable by keyboard and touch). */
  button?: boolean;
}

export interface RowFold {
  open: boolean;
  onToggle: () => void;
}

export interface RowProps {
  title: string;
  /** One quiet line under the title. */
  meta?: string;
  /** The one right-aligned value. */
  value?: string;
  /** An always-visible meter between the text and the value, such as a `Meter`. */
  bar?: ReactNode;
  /** The type glyph, drawn by the caller. */
  glyph?: ReactNode;
  selected?: boolean;
  onOpen?: () => void;
  /** Buttons that show on hover, focus or selection and are hidden otherwise. */
  actions?: ReactNode;
  /** The item menu: right-click or `.` opens it. */
  menu?: RowMenu;
  /** A status dot before the value. */
  status?: { tone: DotTone; label?: string };
  /** A finished item: the title goes faint. */
  done?: boolean;
  /** Makes the row fold: a chevron, `aria-expanded`, and arrow keys. */
  fold?: RowFold;
  /** Nesting depth of a folding tree, 0 to 2 (24 px in each). */
  level?: 0 | 1 | 2;
  /** Keeps `actions` and the ⋯ button visible, not only on hover, focus or selection. */
  actionsShown?: boolean;
}

/** One line of a list: glyph, title, one meta, one value; actions appear on hover. */
export function Row({
  title,
  meta,
  value,
  bar,
  glyph,
  selected,
  onOpen,
  actions,
  menu,
  status,
  done,
  fold,
  level = 0,
  actionsShown,
}: RowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const interactive = Boolean(onOpen || fold);
  const open = () => (onOpen ? onOpen() : fold?.onToggle());
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (interactive && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      open();
    } else if (fold && e.key === "ArrowRight" && !fold.open) {
      e.preventDefault();
      fold.onToggle();
    } else if (fold && e.key === "ArrowLeft" && fold.open) {
      e.preventDefault();
      fold.onToggle();
    } else if (menu && e.key === ".") {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: r.left + 16,
          clientY: r.bottom,
        }),
      );
    }
  };
  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    fold?.onToggle();
  };
  const classes = ["kit-row"];
  if (selected) classes.push("kit-row-sel");
  if (done) classes.push("kit-row-done");
  if (fold || level) classes.push("kit-row-tree");
  if (level) classes.push(`kit-row-lv${level}`);
  if (actionsShown) classes.push("kit-row-acts-on");
  const row = (
    <div
      ref={ref}
      className={classes.join(" ")}
      data-ui="row"
      role={interactive ? "button" : undefined}
      tabIndex={interactive || menu ? 0 : undefined}
      aria-expanded={fold ? fold.open : undefined}
      onClick={interactive ? open : undefined}
      onKeyDown={onKeyDown}
    >
      {fold ? (
        <span onClick={toggle} className="kit-chev-hit">
          <svg
            className={fold.open ? "kit-chev kit-chev-open" : "kit-chev"}
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <path d="M4.5 2.5 8 6l-3.5 3.5" />
          </svg>
        </span>
      ) : null}
      {glyph}
      <div className="kit-row-text">
        <div className="kit-row-title">{title}</div>
        {meta ? <span className="kit-row-meta">{meta}</span> : null}
      </div>
      {bar ? <span className="kit-row-bar">{bar}</span> : null}
      {actions || menu?.button ? (
        <span className="kit-row-act">
          {actions}
          {menu?.button ? (
            <Menu
              label={menu.label}
              items={menu.items}
              onPick={menu.onPick}
              trigger={
                <Button
                  kind="icon"
                  aria-label={menu.label}
                  onClick={(e) => e.stopPropagation()}
                >
                  ⋯
                </Button>
              }
            />
          ) : null}
        </span>
      ) : null}
      {status || value ? (
        <span className="kit-row-value">
          {status ? <Dot tone={status.tone} label={status.label} /> : null}
          {value}
        </span>
      ) : null}
    </div>
  );
  return menu ? (
    <Menu
      on="contextmenu"
      label={menu.label}
      items={menu.items}
      onPick={menu.onPick}
      trigger={row}
    />
  ) : (
    row
  );
}

export interface EditorCell {
  /** What the cell is for; screen readers and tests find it by this. */
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export interface EditorRowProps {
  /** Two cells (a term and its meaning), or one (a step). */
  cells: [EditorCell] | [EditorCell, EditorCell];
  /** Buttons that show on hover or focus. */
  actions?: ReactNode;
}

/** A set editor line: one or two borderless cells that edit in place. */
export function EditorRow({ cells, actions }: EditorRowProps) {
  return (
    <div
      className={cells.length === 1 ? "kit-erow kit-erow-one" : "kit-erow"}
      data-ui="editor-row"
    >
      {cells.map((c) => (
        <input
          key={c.label}
          className="kit-cell"
          type="text"
          aria-label={c.label}
          value={c.value}
          onChange={(e) => c.onChange(e.target.value)}
        />
      ))}
      {actions ? <span className="kit-row-act">{actions}</span> : null}
    </div>
  );
}
