import { expect, test } from "vitest";
import type { AttemptRow } from "../attempt/index.ts";
import { answersOf, gradedBySpot } from "./attempts.ts";
import { dueCounts } from "./tally.ts";

const at = Date.parse("2026-11-03T10:00:00Z");
const row = (o: Partial<AttemptRow>): AttemptRow =>
  ({
    id: "att_1",
    item_id: "q1",
    item_v: 1,
    set_id: "s",
    how: "chose",
    answer: null,
    score: null,
    answered_at: at,
    ...o,
  }) as AttemptRow;

test("a score of 0.5 or more is right; none carries no verdict", () => {
  const out = answersOf([
    row({ id: "att_a", score: 0.5 }),
    row({ id: "att_b", score: 0.4 }),
    row({ id: "att_c", how: "told" }),
  ]);
  const tries = out.map((d) => d.data.answers.q1![d.id]);
  expect(tries).toEqual([
    { at: "2026-11-03T10:00:00.000Z", correct: true },
    { at: "2026-11-03T10:00:00.000Z", correct: false },
    { at: "2026-11-03T10:00:00.000Z" },
  ]);
  expect(out[0]!.data).toMatchObject({ schema: 2, setId: "s" });
});

test("a self-rating carries its rating, never a score", () => {
  const [d] = answersOf([
    row({ how: "self", answer: { rating: "good" }, score: null }),
  ]);
  expect(d!.data.answers.q1!.att_1).toEqual({
    at: "2026-11-03T10:00:00.000Z",
    rating: "good",
  });
});

test("the adapter's output feeds the tally", () => {
  expect(() => dueCounts(answersOf([row({ score: 1 })]))).not.toThrow();
});

test("gradedBySpot groups graded answers by their item's weak spot", () => {
  const items = [
    { id: "q1", weak_spot_id: "w1" },
    { id: "q2", weak_spot_id: null },
  ];
  const by = gradedBySpot(
    [
      row({ score: 1 }),
      row({ item_id: "q2", score: 1 }),
      row({ score: null }),
      row({ score: 0.2 }),
    ],
    items,
  );
  expect([...by.keys()]).toEqual(["w1"]);
  expect(by.get("w1")).toEqual([
    { at: "2026-11-03T10:00:00.000Z", correct: true },
    { at: "2026-11-03T10:00:00.000Z", correct: false },
  ]);
});
