import { expect, test } from "vitest";
import { mapLibrary } from "./map.ts";
import { attemptRow, itemRow, setRow } from "./testHost.tsx";

const now = Date.parse("2026-11-04T18:00:00Z");
test("mapLibrary carries the accuracy line and a set's due count", () => {
  const d = mapLibrary(
    {
      goals: [],
      weakspots: [],
      sets: [setRow({ id: "s1" })],
      items: [
        itemRow("item_q1", "s1", {
          stem: "How many mL?",
          options: ["5 mL"],
          correct: [0],
        }),
      ],
      attempts: [attemptRow("s1", "item_q1", "2026-11-03T10:00:00Z", 0)],
    },
    now,
  );
  expect(d.accuracy).toEqual({ text: "0%" });
  expect(d.sets[0]?.due).toBe("1 due");
  expect(
    mapLibrary({ goals: [], weakspots: [], sets: [] }, now).accuracy,
  ).toBeNull();
});
