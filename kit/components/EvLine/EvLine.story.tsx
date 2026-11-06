import { EvLine } from "./EvLine";

export function Story() {
  return (
    <div
      data-ui="story-ev-line"
      style={{ display: "grid", gap: "var(--sp-4)" }}
    >
      <EvLine>
        Two sets are due and your history quiz is Friday. Start with
        Photosynthesis?
      </EvLine>
      <EvLine quiet>
        <b>Check, in your own words.</b> Why does the price rise when
        demand rises?
      </EvLine>
    </div>
  );
}
