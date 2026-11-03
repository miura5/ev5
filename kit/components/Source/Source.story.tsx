import { Source } from "./Source";

export function Story() {
  return (
    <div data-ui="story-source" style={{ display: "flex", gap: "var(--sp-3)" }}>
      <Source from="Heparin and warfarin" onOpen={() => undefined} />
      <Source from="Fluid balance" />
      <Source />
    </div>
  );
}
