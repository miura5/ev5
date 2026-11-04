import type { InputHTMLAttributes } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";

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

/** A short choice, one option on at a time; one Tab stop, arrows move between options. */
export function Segmented({ label, options, value, onChange }: SegmentedProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix reports "" when the lit option is tapped again; a choice always stays on.
      onValueChange={(v) => v && onChange(v)}
      aria-label={label}
      className="kit-seg"
      data-ui="segmented"
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o} value={o}>
          {o}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
