import { useEffect, useRef, useState, type ReactNode } from "react";

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
}

/** The ⌘K palette: type to filter, arrows move, Enter runs, Tab asks E.V., Esc closes. */
export function Palette({ groups, onRun, onAsk, onClose }: PaletteProps) {
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
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
  const keys: string[] = shown.flatMap((g) => g.items.map((it) => it.key));
  const count = keys.length + (q ? 1 : 0);
  const on = Math.max(0, Math.min(at, count - 1));
  const run = (i: number) => {
    if (i >= keys.length) {
      if (q) onAsk(q);
    } else if (keys[i] !== undefined) onRun(keys[i]);
  };
  const move = (to: number) => setAt(count === 0 ? 0 : (to + count) % count);
  let n = -1;
  const rowClass = (i: number) => `kit-pal-row${i === on ? " kit-pal-on" : ""}`;
  return (
    <div
      className="kit-pal-scrim"
      data-ui="palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="kit-pal"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <input
          ref={input}
          className="kit-pal-in"
          role="combobox"
          aria-expanded="true"
          aria-controls="kit-pal-list"
          aria-activedescendant={count ? `kit-pal-${on}` : undefined}
          autoComplete="off"
          placeholder="Type a command, find anything, or ask E.V."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAt(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") move(on + 1);
            else if (e.key === "ArrowUp") move(on - 1);
            else if (e.key === "Enter") run(on);
            else if (e.key === "Tab") onAsk(q);
            else return;
            e.preventDefault();
          }}
        />
        <div
          className="kit-pal-list"
          id="kit-pal-list"
          role="listbox"
          aria-label="Results"
        >
          {shown.map((g) => (
            <div key={g.name} role="group" aria-label={g.name}>
              <div className="kit-pal-label">{g.name}</div>
              {g.items.map((it) => {
                const i = ++n;
                return (
                  <div
                    key={it.key}
                    id={`kit-pal-${i}`}
                    role="option"
                    aria-selected={i === on}
                    className={rowClass(i)}
                    onMouseEnter={() => setAt(i)}
                    onClick={() => run(i)}
                  >
                    {it.glyph}
                    <span className="kit-pal-text">{it.label}</span>
                    {it.hint ? <kbd className="kit-kbd">{it.hint}</kbd> : null}
                  </div>
                );
              })}
            </div>
          ))}
          {q ? (
            <div
              id={`kit-pal-${keys.length}`}
              role="option"
              aria-selected={keys.length === on}
              className={rowClass(keys.length)}
              onMouseEnter={() => setAt(keys.length)}
              onClick={() => run(keys.length)}
            >
              <span className="kit-pal-mark" aria-hidden="true" />
              <span className="kit-pal-text">Ask E.V.: {q}</span>
              <kbd className="kit-kbd">Tab</kbd>
            </div>
          ) : null}
        </div>
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
      </div>
    </div>
  );
}
