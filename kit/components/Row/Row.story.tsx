import { Row } from "./Row";

export function Story() {
  return (
    <div data-ui="story-row">
      <Row
        title="Heparin and warfarin"
        meta="12 cards · NUR 112"
        value="3 due"
        onOpen={() => undefined}
      />
      <Row title="Fluid balance" value="Yesterday" selected />
      <Row title="Add a note" />
      <div data-focus-shown style={{ display: "contents" }}>
        <Row title="Focused row" onOpen={() => undefined} />
      </div>
    </div>
  );
}
