import { EvLine } from "./EvLine";

export function Story() {
  return (
    <div
      data-ui="story-ev-line"
      style={{ display: "grid", gap: "var(--sp-4)" }}
    >
      <EvLine>
        Two sets are due and your pharmacology quiz is Friday. Start with
        Heparin?
      </EvLine>
      <EvLine quiet>
        <b>Check, in your own words.</b> Why does stroke volume rise when
        preload rises?
      </EvLine>
    </div>
  );
}
