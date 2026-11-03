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
export function TextOptions({ options, value, onChange, label }: TextOptionsProps) {
  return (
    <div className="kit-opts" data-ui="text-options" role="group" aria-label={label}>
      {options.map((o, i) => (
        <span key={o.value} className="kit-opts-item">
          {i > 0 ? (
            <span className="kit-opts-sep" aria-hidden="true">
              ·
            </span>
          ) : null}
          <button
            type="button"
            className={o.value === value ? "kit-opt kit-opt-on" : "kit-opt"}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.count === undefined ? null : <span className="kit-opt-n">{o.count}</span>}
          </button>
        </span>
      ))}
    </div>
  );
}
