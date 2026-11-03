import type { InputHTMLAttributes } from "react";

export interface FieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> {
  /** What the field is for; every field needs one, seen or not. */
  label: string;
}

/** The one bordered input. */
export function Field({ label, ...rest }: FieldProps) {
  return (
    <input {...rest} aria-label={label} className="kit-field" data-ui="field" />
  );
}

export interface SegmentedProps {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}

/** A short choice, one option on at a time. */
export function Segmented({ label, options, value, onChange }: SegmentedProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="kit-seg"
      data-ui="segmented"
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
