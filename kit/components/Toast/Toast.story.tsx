import { Toast } from "./Toast";

export function Story() {
  return (
    <div data-ui="story-toast">
      <Toast message="Moved to Recently deleted" onUndo={() => undefined} />
    </div>
  );
}
