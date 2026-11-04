import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Button, Field } from "../../../kit/index.ts";

/** The small form under a section's Add: a title, and a date when `withDate`; Esc or Cancel closes it. */
export function AddLine({
  label,
  withDate,
  onSubmit,
  onCancel,
}: {
  label: string;
  withDate?: boolean;
  /** Resolves true once saved (the form then closes); false keeps it open for another try. */
  onSubmit: (title: string, date: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = title.trim() !== "" && (!withDate || date !== "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    void onSubmit(title.trim(), date).then((ok) => {
      setBusy(false);
      if (ok) onCancel();
    });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
  };
  return (
    <form
      className="ev-today-add"
      aria-label={label}
      onSubmit={submit}
      onKeyDown={onKey}
    >
      <Field
        label="Title"
        placeholder={withDate ? "What is coming up" : "What to do today"}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      {withDate ? (
        <Field
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      ) : null}
      <Button kind="primary" type="submit" disabled={!ready || busy}>
        Add
      </Button>
      <Button kind="text" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
