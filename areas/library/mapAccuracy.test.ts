import { expect, test } from "vitest";
import { mapLibrary } from "./map.ts";

const now = Date.parse("2026-11-04T18:00:00Z");
const ans = (setId: string, item: string, at: string, c?: boolean) => ({
  id: `${setId}-${item}-${at}`,
  data: {
    schema: 2,
    setId,
    answers: {
      [item]: {
        k: { at, ...(c === undefined ? { outcome: "told" } : { correct: c }) },
      },
    },
  },
});

test("mapLibrary carries the accuracy line and a set's due count", () => {
  const set = {
    schema: 3,
    writer: "page",
    at: "2026-10-01T15:00:00Z",
    source: "test",
    kind: "drill",
    title: "Doses",
    items: [
      { id: "q1", stem: "How many mL?", options: ["5 mL"], correct: [0] },
    ],
  };
  const d = mapLibrary(
    {
      goals: [],
      weakspots: [],
      sets: [{ id: "s1", data: set }],
      answers: [ans("s1", "q1", "2026-11-03T10:00:00Z", false)],
    },
    now,
  );
  expect(d.accuracy).toEqual({ text: "0%" });
  expect(d.sets[0]?.due).toBe("1 due");
  expect(
    mapLibrary({ goals: [], weakspots: [], sets: [] }, now).accuracy,
  ).toBeNull();
});
