/** The eight item types, plus the plan item's done state. */
export const GLYPH_TYPES = [
  "note",
  "cards",
  "questions",
  "steps",
  "plan",
  "job",
  "collection",
  "date",
] as const;
export type GlyphType = (typeof GLYPH_TYPES)[number];

const PATHS: Record<GlyphType | "done", string> = {
  note: "M4 2.5h5l3 3v8H4zM9 2.5v3h3M6 8.5h4M6 11h2.5",
  cards:
    "M2.5 6.5a1.5 1.5 0 0 1 1.5-1.5h5.5a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5zM5.5 2.5H12a1.5 1.5 0 0 1 1.5 1.5v6.5",
  questions:
    "M4.5 2.5h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM6.4 6.6a1.6 1.6 0 1 1 2.3 1.4c-.5.3-.7.6-.7 1.1v.2M8 11.2v.01",
  steps: "M2.5 13.5v-3h3.5V7h3.5V3.5h4v10z",
  plan: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z",
  done: "M8 2.25a5.75 5.75 0 1 0 0 11.5 5.75 5.75 0 0 0 0-11.5z",
  job: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z",
  collection:
    "M2.5 5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z",
  date: "M4 3.5h8a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V5A1.5 1.5 0 0 1 4 3.5zM2.5 6.5h11M5.5 2v3M10.5 2v3",
};

export interface GlyphProps {
  type: GlyphType;
  /** Plan item only: the filled, ticked ring. */
  done?: boolean;
  /** Job only: the ring turns while the job runs. */
  running?: boolean;
}

/** One monochrome line glyph per item type, 16 px, in the quiet grey. Decorative: the row's title names the thing. */
export function Glyph({ type, done, running }: GlyphProps) {
  const isDone = type === "plan" && done;
  const cls = [
    "kit-glyph",
    type === "job" ? "kit-glyph-job" : "",
    type === "job" && running ? "kit-glyph-run" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <svg
      className={cls}
      data-ui="glyph"
      data-type={type}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        className={isDone ? "kit-glyph-fill" : undefined}
        d={PATHS[isDone ? "done" : type]}
      />
      {isDone ? (
        <path className="kit-glyph-tick" d="M5.6 8.1l1.7 1.7 3.2-3.3" />
      ) : null}
    </svg>
  );
}
