export const DOT_TONES = ["ok", "warn", "bad", "her", "faint"] as const;
export type DotTone = (typeof DOT_TONES)[number];

export interface DotProps {
  /** The status colour: ok (also a live session), warn, bad, her (E.V.) or faint (quiet). */
  tone: DotTone;
  /** Words for the state when no text beside it says it; leave out when the dot is only decoration. */
  label?: string;
  /** Work is running (or something is loading): the dot pulses, once per --dur-think. Still under reduced motion. */
  pulse?: boolean;
}

/** The 6 px status dot. Status shows as a dot or a meter, never a coloured word. */
export function Dot({ tone, label, pulse }: DotProps) {
  return (
    <i
      className="kit-dot"
      data-ui="dot"
      data-tone={tone}
      data-pulse={pulse ? "" : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
