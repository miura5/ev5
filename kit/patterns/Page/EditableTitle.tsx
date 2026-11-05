import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export interface EditableTitleProps {
  value: string;
  /** Called with the new name when it changes and is not empty. */
  onRename: (title: string) => void;
  /** Shown when the title is empty. */
  placeholder?: string;
  /** Focus and select the title on mount: for an item that was just made. */
  autoFocus?: boolean;
  label?: string;
}

/** A title that edits in place: blur renames, Enter commits, Escape puts the old name back. */
export function EditableTitle({
  value,
  onRename,
  placeholder,
  autoFocus,
  label = "Title",
}: EditableTitleProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
    ref.current?.select();
  }, [autoFocus]);
  const commit = () => {
    const next = draft.trim();
    if (!next) setDraft(value);
    else {
      setDraft(next);
      if (next !== value) onRename(next);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(value);
      e.currentTarget.blur();
    }
  };
  return (
    <input
      ref={ref}
      className="kit-head-input"
      data-ui="editable-title"
      type="text"
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}
