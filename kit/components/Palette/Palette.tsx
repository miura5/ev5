import "./browser-gaps";
import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";

export interface PaletteItem {
  key: string;
  label: string;
  /** The key that does the same thing. */
  hint?: string;
  /** The type glyph, drawn by the caller. */
  glyph?: ReactNode;
  /** A picker's nesting depth: a child sits under its parent. */
  indent?: number;
  /** A picker's current choice, marked with a check. */
  current?: boolean;
}

export interface PaletteGroup {
  name: string;
  items: PaletteItem[];
}

export interface PaletteProps {
  /** Commands, found items, pins and places, already scoped to where Matt is. */
  groups: PaletteGroup[];
  onRun: (key: string) => void;
  /** Tab, or the last row: hand the typed request to E.V. */
  onAsk?: (text: string) => void;
  onClose: () => void;
  /** Called with the text in the box each time it changes, so the caller can add found items to `groups`. */
  onQuery?: (text: string) => void;
  /** Where the palette is drawn; the page body when omitted (the gallery draws it inside its story). */
  container?: HTMLElement | null;
  /** False makes a plain picker: no "Ask E.V." row and no Tab. The command palette leaves it on. */
  ask?: boolean;
  /** The box's placeholder, and the dialog's name; the command palette's own when omitted. */
  placeholder?: string;
  label?: string;
}

/** The ⌘K palette on cmdk inside a Radix dialog (behaviour only): type to filter, arrows move, Enter runs, Tab asks E.V., Esc closes. */
export function Palette({
  groups,
  onRun,
  onAsk,
  onClose,
  onQuery,
  container,
  ask = true,
  placeholder = "Type a command, find anything, or ask E.V.",
  label = "Command palette",
}: PaletteProps) {
  const [query, setQuery] = useState("");
  // Radix returns focus only to a Trigger; the palette has none, so it hands focus back itself on close.
  const [from] = useState(() => document.activeElement);
  useEffect(
    () => () => {
      setTimeout(() => {
        if (from instanceof HTMLElement && from.isConnected) from.focus();
      });
    },
    [from],
  );
  const q = query.trim();
  const needle = q.toLowerCase();
  const shown = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => !needle || it.label.toLowerCase().includes(needle),
      ),
    }))
    .filter((g) => g.items.length > 0);
  return (
    <Dialog.Root
      open
      // Drawn inside a gallery story, the page behind stays reachable; over the app it is modal.
      modal={!container}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay className="kit-pal-scrim" />
        <Dialog.Content
          className="kit-pal"
          aria-describedby={undefined}
          // In a gallery story the input must not take focus on load: that scrolls the page down to the sample.
          onOpenAutoFocus={(e) => {
            if (container) e.preventDefault();
          }}
          onKeyDown={(e) => {
            if (!ask || e.key !== "Tab") return;
            e.preventDefault();
            onAsk?.(q);
          }}
        >
          <Dialog.Title className="kit-pal-title">{label}</Dialog.Title>
          <Command data-ui="palette" label={label} shouldFilter={false} loop>
            <Command.Input
              className="kit-pal-in"
              autoComplete="off"
              placeholder={placeholder}
              value={query}
              onValueChange={(text) => {
                setQuery(text);
                onQuery?.(text);
              }}
            />
            <Command.List className="kit-pal-list" aria-label="Results">
              {shown.map((g) => (
                <Command.Group
                  key={g.name}
                  heading={g.name}
                  aria-label={g.name}
                  className="kit-pal-group"
                >
                  {g.items.map((it) => (
                    <Command.Item
                      key={it.key}
                      value={it.key}
                      className="kit-pal-row"
                      style={
                        it.indent
                          ? {
                              paddingLeft: `calc(var(--sp-2) + ${it.indent} * var(--sp-6))`,
                            }
                          : undefined
                      }
                      onSelect={() => onRun(it.key)}
                    >
                      {it.glyph}
                      <span className="kit-pal-text">{it.label}</span>
                      {it.current ? (
                        <span className="kit-pal-current" aria-label="current">
                          ✓
                        </span>
                      ) : null}
                      {it.hint ? (
                        <kbd className="kit-kbd">{it.hint}</kbd>
                      ) : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
              {ask && q ? (
                <Command.Item
                  value="\u0000ask"
                  className="kit-pal-row"
                  onSelect={() => onAsk?.(q)}
                >
                  <span className="kit-pal-mark" aria-hidden="true" />
                  <span className="kit-pal-text">Ask E.V.: {q}</span>
                  <kbd className="kit-kbd">Tab</kbd>
                </Command.Item>
              ) : null}
            </Command.List>
            <div className="kit-pal-foot">
              {ask ? (
                <span className="kit-pal-hint">
                  <kbd className="kit-kbd">Tab</kbd>ask E.V.
                </span>
              ) : null}
              <span className="kit-pal-grow" />
              <span className="kit-pal-hint">
                <kbd className="kit-kbd">↑↓</kbd>move
              </span>
              <span className="kit-pal-hint">
                <kbd className="kit-kbd">↵</kbd>run
              </span>
              <span className="kit-pal-hint">
                <kbd className="kit-kbd">Esc</kbd>close
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
