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
        title="Photosynthesis and respiration"
        meta="12 cards · Course 101"
        value="3 due"
        onOpen={() => undefined}
      />
      <Tile title="Market structure" meta="8 questions" />
    </div>
  );
}
