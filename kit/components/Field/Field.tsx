import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
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

export interface TextAreaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
> {
  /** What the box is for; every box needs one, seen or not. */
  label: string;
}

/** The one bordered multi-line field: Ask's message box, a session answer. */
export function TextArea({ label, rows = 2, ...rest }: TextAreaProps) {
  return (
    <textarea
      {...rest}
      rows={rows}
      aria-label={label}
      className="kit-field kit-textarea"
      data-ui="textarea"
    />
  );
}

export interface ChoiceProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "type" | "children"
> {
  /** "checkbox" for a done/not-done row, "radio" for one of several answers. */
  kind: "checkbox" | "radio";
  children?: ReactNode;
}

/** A checkbox or radio with its words; the words are its label. */
export function Choice({ kind, children, ...rest }: ChoiceProps) {
  const box = (
    <input {...rest} type={kind} className="kit-choice-box" data-ui={kind} />
  );
  if (children === undefined) return box;
  return (
    <label className="kit-choice" data-ui="choice">
      {box}
      {children}
    </label>
  );
}
