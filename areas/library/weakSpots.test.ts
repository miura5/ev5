import { expect, test } from "vitest";
import type { AttemptRow, SetItemRow } from "../../domain/index.ts";
import { spotRow } from "./testHost.tsx";
import { spotsOf } from "./weakSpots.ts";

const item = (id: string, spot: string | null) =>
  ({ id, weak_spot_id: spot }) as SetItemRow;
const att = (id: string, item_id: string, score: number | null, day: number) =>
  ({
    id,
    item_id,
    score,
    answered_at: Date.parse(`2026-11-0${day}T15:00:00Z`),
  }) as AttemptRow;

test("a spot's misses and streak come from its answers", () => {
  const [s] = spotsOf({
    goals: [],
    weakspots: [spotRow()],
    items: [item("i1", "ws_1")],
    attempts: [
      att("a1", "i1", 0, 1),
      att("a2", "i1", 0, 2),
      att("a3", "i1", 1, 3),
    ],
  });
  expect(s?.d.misses).toBe(2);
  expect(s?.d.streak).toBe(1);
  const [none] = spotsOf({ goals: [], weakspots: [spotRow()] });
  expect(none?.d.misses).toBe(0);
});
