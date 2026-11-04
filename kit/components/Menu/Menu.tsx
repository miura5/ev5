import type { ReactElement } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

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
  /** Called when the menu closes, picked or not. */
  onClose?: () => void;
  label: string;
  /** The element that opens the menu (a button, or the region that takes a right-click). */
  trigger: ReactElement;
  /** `click` opens a dropdown from the trigger; `contextmenu` opens at the pointer on right-click. */
  on?: "click" | "contextmenu";
}

/** Runs of picker items share one radio group; plain items stand alone. */
function groups(items: MenuItem[]): MenuItem[][] {
  const out: MenuItem[][] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (prev && (prev[0]?.checked === undefined) === (it.checked === undefined))
      prev.push(it);
    else out.push([it]);
  }
  return out;
}

/** Item actions and every picker, on Radix (behaviour only): arrows move, Enter picks, Esc closes, typeahead. */
export function Menu({
  items,
  onPick,
  onClose,
  label,
  trigger,
  on = "click",
}: MenuProps) {
  const M = on === "contextmenu" ? ContextMenu : DropdownMenu;
  const row = (it: MenuItem) => {
    const cls = `kit-menu-item${it.danger ? " kit-menu-bad" : ""}`;
    const body = (
      <>
        <span className="kit-menu-check" aria-hidden="true">
          {it.checked ? "✓" : ""}
        </span>
        <span className="kit-menu-label">{it.label}</span>
        {it.hint ? <kbd className="kit-kbd">{it.hint}</kbd> : null}
      </>
    );
    return it.checked === undefined ? (
      <M.Item
        key={it.key}
        className={cls}
        textValue={it.label}
        onSelect={() => onPick(it.key)}
      >
        {body}
      </M.Item>
    ) : (
      <M.RadioItem
        key={it.key}
        className={cls}
        value={it.key}
        textValue={it.label}
        onSelect={() => onPick(it.key)}
      >
        {body}
      </M.RadioItem>
    );
  };
  return (
    <M.Root onOpenChange={(open: boolean) => (open ? undefined : onClose?.())}>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content loop className="kit-menu" data-ui="menu" aria-label={label}>
          {groups(items).map((g) =>
            g[0]?.checked === undefined ? (
              g.map(row)
            ) : (
              <M.RadioGroup
                key={g[0].key}
                value={g.find((it) => it.checked)?.key ?? ""}
              >
                {g.map(row)}
              </M.RadioGroup>
            ),
          )}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
