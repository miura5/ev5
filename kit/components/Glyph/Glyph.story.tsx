import { GLYPH_TYPES, Glyph } from "./Glyph";

const NAMES = [
  "Note",
  "Card set",
  "Question set",
  "Step set",
  "Plan item",
  "Job",
  "Collection",
  "Date",
];

export function Story() {
  return (
    <div
      data-ui="story-glyph"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "var(--sp-4) var(--sp-6)",
      }}
    >
      {GLYPH_TYPES.map((type, i) => (
        <div
          key={type}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-3)",
            height: "var(--row)",
          }}
        >
          <Glyph type={type} />
          <span style={{ color: "var(--quiet)" }}>{NAMES[i]}</span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          height: "var(--row)",
        }}
      >
        <Glyph type="plan" done />
        <span style={{ color: "var(--quiet)" }}>Plan item, done</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          height: "var(--row)",
        }}
      >
        <Glyph type="job" running />
        <span style={{ color: "var(--quiet)" }}>Job, running</span>
      </div>
    </div>
  );
}
