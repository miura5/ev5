import type { ReactNode } from "react";

export interface EvLineProps {
  /** Her mark is the screen's one orange element; leave it quiet when something else holds the orange. */
  quiet?: boolean;
  children: ReactNode;
}

/** E.V. speaking once: her dotted mark, then one quiet line. Wrap the lead words in <b> to bring them up to text. */
export function EvLine({ quiet, children }: EvLineProps) {
  return (
    <div className="kit-evline" data-ui="ev-line">
      <span
        className={quiet ? "kit-evmark kit-evmark-quiet" : "kit-evmark"}
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}
