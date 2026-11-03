import { Suggestion } from "./Suggestion";

export function Story() {
  const noop = () => undefined;
  return (
    <div data-ui="story-suggestion">
      <Suggestion text="5 dosage-by-weight problems tonight · 10m" onAccept={noop} onEdit={noop} onDismiss={noop} />
      <Suggestion kind="draft" text="Card: heparin antidote is protamine" onAccept={noop} onDismiss={noop} />
    </div>
  );
}
