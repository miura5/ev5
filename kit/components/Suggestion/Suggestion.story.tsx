import { Suggestion } from "./Suggestion";

export function Story() {
  const noop = () => undefined;
  return (
    <div data-ui="story-suggestion">
      <Suggestion text="5 unit-conversion problems tonight · 10m" onAccept={noop} onEdit={noop} onDismiss={noop} />
      <Suggestion kind="draft" text="Card: chlorophyll absorbs red and blue light" onAccept={noop} onDismiss={noop} />
    </div>
  );
}
