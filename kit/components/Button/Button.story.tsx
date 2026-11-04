import { Button } from "./Button";

export function Story() {
  return (
    <div data-ui="story-button">
      <Button kind="primary" hint="C">
        New note
      </Button>
      <Button kind="primary" disabled hint="↵">
        Turn over
      </Button>
      <Button kind="secondary">End</Button>
      <span data-focus-shown style={{ display: "contents" }}>
        <Button kind="secondary">Focused</Button>
      </span>
      <Button kind="text" hint="E">
        Edit
      </Button>
      <Button kind="icon" aria-label="Close">
        ×
      </Button>
    </div>
  );
}
