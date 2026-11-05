export const DOT_TONES = ["ok", "warn", "bad", "info", "her", "faint"] as const;
export type DotTone = (typeof DOT_TONES)[number];

export interface DotProps {
  /** The status colour: ok, warn, bad, info, her (E.V.) or faint (quiet). */
  tone: DotTone;
  /** Words for the state when no text beside it says it; leave out when the dot is only decoration. */
  label?: string;
}

/** The 6 px status dot. Status shows as a dot or a meter, never a coloured word. */
export function Dot({ tone, label }: DotProps) {
  return (
    <i
      className="kit-dot"
      data-ui="dot"
      data-tone={tone}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
