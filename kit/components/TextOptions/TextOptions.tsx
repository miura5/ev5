import * as ToggleGroup from "@radix-ui/react-toggle-group";

export interface TextOption {
  value: string;
  label: string;
  /** A quiet count after the label. */
  count?: number;
}

export interface TextOptionsProps {
  options: TextOption[];
  value: string;
  onChange: (value: string) => void;
  /** Names the group for assistive tech, e.g. "Filter". */
  label: string;
}

/** A filter row or the study modes, as quiet words; the chosen one is lit. */
export function TextOptions({
  options,
  value,
  onChange,
  label,
}: TextOptionsProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix reports "" when the lit option is tapped again; a choice always stays on.
      onValueChange={(v) => v && onChange(v)}
      className="kit-opts"
      data-ui="text-options"
      aria-label={label}
    >
      {options.map((o, i) => (
        <span key={o.value} className="kit-opts-item">
          {i > 0 ? (
            <span className="kit-opts-sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          <ToggleGroup.Item value={o.value} className="kit-opt">
            {o.label}
            {o.count === undefined ? null : (
              <span className="kit-opt-n">{o.count}</span>
            )}
          </ToggleGroup.Item>
        </span>
      ))}
    </ToggleGroup.Root>
  );
}
