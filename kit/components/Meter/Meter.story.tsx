import { Meter, type MeterPart } from "./Meter";

const CASES: { label: string; parts: MeterPart[] }[] = [
  {
    label: "Learned 6, familiar 3, weak 1",
    parts: [
      { tone: "ok", count: 6 },
      { tone: "warn", count: 3 },
      { tone: "bad", count: 1 },
    ],
  },
  {
    label: "Nothing weak: learned 5, familiar 2",
    parts: [
      { tone: "ok", count: 5 },
      { tone: "warn", count: 2 },
    ],
  },
  { label: "All weak: 4", parts: [{ tone: "bad", count: 4 }] },
  { label: "Nothing studied yet", parts: [] },
];

export function Story() {
  return (
    <div
      data-ui="story-meter"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-4)",
        maxWidth: "var(--col)",
      }}
    >
      {CASES.map((c) => (
        <Meter key={c.label} label={c.label} parts={c.parts} />
      ))}
    </div>
  );
}
