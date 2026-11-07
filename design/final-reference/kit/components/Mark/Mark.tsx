import type { CSSProperties } from "react";

/** The small-size cut of the Consolidate symbol (256 box): two dots, two dashes and the line, clockwise from the top. */
const PARTS = [
  { d: "M143.48 32.87A95.70 95.70 0 0 1 143.56 32.88", sw: 30.6 },
  { d: "M201.96 66.57A95.70 95.70 0 0 1 202.01 66.63", sw: 36.0 },
  { d: "M223.67 129.93A95.70 95.70 0 0 1 221.77 146.50", sw: 36.65 },
  { d: "M188.87 201.17A95.70 95.70 0 0 1 150.34 220.37", sw: 36.65 },
  { d: "M90.69 215.44A95.70 95.70 0 0 1 57.97 62.10", sw: 36.65 },
];

export interface MarkProps {
  /** Faint instead of ember, when something else on the screen holds the orange. */
  quiet?: boolean;
  /** The sidebar's identity mark: 20 px, in the text grey. */
  logo?: boolean;
}

/** E.V.'s mark at icon size. It is her name, so it stands still: no arrive, no step count, no loading.
 *  Running work is the Dot with pulse. Decorative: the line or row beside it says what is happening. */
export function Mark({ quiet, logo }: MarkProps) {
  const cls = ["kit-mark", quiet ? "kit-mark-quiet" : "", logo ? "kit-mark-logo" : ""].filter(Boolean).join(" ");
  return (
    <svg className={cls} data-ui="mark" viewBox="0 0 256 256" aria-hidden="true">
      {PARTS.map((p, i) => (
        <path key={i} d={p.d} style={{ "--sw": p.sw } as CSSProperties} />
      ))}
    </svg>
  );
}
