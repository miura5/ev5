import { Mark } from "./Mark";

const cell = { display: "flex", alignItems: "center", gap: "var(--sp-3)", height: "var(--row)", color: "var(--quiet)" };

export function Story() {
  return (
    <div data-ui="story-mark" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0 var(--sp-6)" }}>
      <div style={cell}><Mark logo />Logo</div>
      <div style={cell}><Mark />E.V. speaks</div>
      <div style={cell}><Mark quiet />E.V. speaks, quiet</div>
    </div>
  );
}
