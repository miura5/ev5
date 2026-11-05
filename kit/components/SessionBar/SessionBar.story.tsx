import { SessionBar } from "./SessionBar";

export function Story() {
  return (
    <div data-ui="story-session-bar" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <SessionBar timer="18:20" readAlong onTogglePause={() => undefined} onEnd={() => undefined} />
      <SessionBar timer="18:20" readAlong paused onTogglePause={() => undefined} onEnd={() => undefined} />
    </div>
  );
}
