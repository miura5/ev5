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
  onAsk: (text: string) => void;
  onClose: () => void;
  /** Where the palette is drawn; the page body when omitted (the gallery draws it inside its story). */
  container?: HTMLElement | null;
}

/** The ⌘K palette on cmdk inside a Radix dialog (behaviour only): type to filter, arrows move, Enter runs, Tab asks E.V., Esc closes. */
export function Palette({
  groups,
  onRun,
  onAsk,
  onClose,
  container,
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
            if (e.key !== "Tab") return;
            e.preventDefault();
            onAsk(q);
          }}
        >
          <Dialog.Title className="kit-pal-title">Command palette</Dialog.Title>
          <Command
            data-ui="palette"
            label="Command palette"
            shouldFilter={false}
            loop
          >
            <Command.Input
              className="kit-pal-in"
              autoComplete="off"
              placeholder="Type a command, find anything, or ask E.V."
              value={query}
              onValueChange={setQuery}
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
                      onSelect={() => onRun(it.key)}
                    >
                      {it.glyph}
                      <span className="kit-pal-text">{it.label}</span>
                      {it.hint ? (
                        <kbd className="kit-kbd">{it.hint}</kbd>
                      ) : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
              {q ? (
                <Command.Item
                  value="\u0000ask"
                  className="kit-pal-row"
                  onSelect={() => onAsk(q)}
                >
                  <span className="kit-pal-mark" aria-hidden="true" />
                  <span className="kit-pal-text">Ask E.V.: {q}</span>
                  <kbd className="kit-kbd">Tab</kbd>
                </Command.Item>
              ) : null}
            </Command.List>
            <div className="kit-pal-foot">
              <span className="kit-pal-hint">
                <kbd className="kit-kbd">Tab</kbd>ask E.V.
              </span>
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
