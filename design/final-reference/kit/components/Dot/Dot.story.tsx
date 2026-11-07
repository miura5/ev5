import { Dot, DOT_TONES } from "./Dot";

export function Story() {
  return (
    <div
      data-ui="story-dot"
      style={{
        display: "flex",
        gap: "var(--sp-6)",
        alignItems: "center",
        fontSize: "var(--fs-body)",
        color: "var(--text)",
      }}
    >
      {DOT_TONES.map((tone) => (
        <span
          key={tone}
          style={{
            display: "inline-flex",
            gap: "var(--sp-2)",
            alignItems: "center",
          }}
        >
          <Dot tone={tone} />
          {tone}
        </span>
      ))}
    </div>
  );
}
