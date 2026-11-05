import type { CSSProperties } from "react";
import type { DotTone } from "../Dot/Dot";

export interface MeterPart {
  tone: Exclude<DotTone, "her" | "faint" | "info">;
  /** How many items sit in this part; the parts share the bar by these numbers. */
  count: number;
}

export interface MeterProps {
  /** What the bar shows, said in words, for example "Learned 6, familiar 3, weak 1". */
  label: string;
  parts: readonly MeterPart[];
}

/** The 4 px segmented bar: learned, familiar and weak side by side. */
export function Meter({ label, parts }: MeterProps) {
  return (
    <span className="kit-meter" data-ui="meter" role="img" aria-label={label}>
      {parts
        .filter((p) => p.count > 0)
        .map((p) => (
          <i
            key={p.tone}
            data-tone={p.tone}
            style={{ "--part": p.count } as CSSProperties}
          />
        ))}
    </span>
  );
}
