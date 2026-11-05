export interface Bar {
  /** The label under the bar. */
  label: string;
  /** The value; bars scale against the largest, or `max` when given. */
  value: number;
  /** Shown on hover. */
  title?: string;
}

export interface BarsProps {
  bars: readonly Bar[];
  /** Scale ceiling (100 for a percentage); defaults to the largest value. */
  max?: number;
  /** Accessible name of the series. */
  label: string;
}

/** A plain weekly bar series: the last bar is the current one and reads a step stronger. */
export function Bars({ bars, max, label }: BarsProps) {
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="kit-bars" data-ui="bars" role="img" aria-label={label}>
      <div className="kit-bars-plot">
        {bars.map((b, i) => (
          <span key={`${b.label}-${i}`} className="kit-bars-col">
            <i
              className={
                i === bars.length - 1 ? "kit-bars-bar now" : "kit-bars-bar"
              }
              style={{ height: `${Math.min(100, (100 * b.value) / top)}%` }}
              title={b.title ?? `${b.label} · ${b.value}`}
            />
          </span>
        ))}
      </div>
      <div className="kit-bars-x">
        {bars.map((b, i) => (
          <span key={`${b.label}-${i}`}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}
