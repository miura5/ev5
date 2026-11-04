import { Toast } from "./Toast";

export function Story() {
  return (
    <div data-ui="story-toast" style={{ position: "relative", height: "calc(var(--row) + var(--sp-6) * 2)", transform: "translateZ(0)" }}>
      <Toast message="Moved to Recently deleted" onUndo={() => undefined} />
    </div>
  );
}
