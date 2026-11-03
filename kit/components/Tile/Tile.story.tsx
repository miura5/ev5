import { Tile } from "./Tile";

export function Story() {
  return (
    <div
      data-ui="story-tile"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "var(--sp-4)",
      }}
    >
      <Tile
        title="Heparin and warfarin"
        meta="12 cards · NUR 112"
        value="3 due"
        onOpen={() => undefined}
      />
      <Tile title="Fluid balance" meta="8 questions" />
    </div>
  );
}
