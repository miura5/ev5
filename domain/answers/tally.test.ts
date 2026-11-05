import { expect, test } from "vitest";
import { accuracyLine, dueCounts } from "./tally.ts";

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

test("accuracy counts each item's first try in the last 14 days, against the 14 before", () => {
  const docs = [
    ans("s", "q1", "2026-11-01T10:00:00Z", true),
    ans("s", "q2", "2026-11-02T10:00:00Z", false),
    ans("s", "q2", "2026-11-03T10:00:00Z", true), // a retry: not a first try
    ans("s", "q3", "2026-11-03T10:00:00Z", true),
    ans("s", "q4", "2026-11-03T11:00:00Z"), // told: neither right nor wrong
    ans("s", "p1", "2026-10-20T10:00:00Z", true),
    ans("s", "p2", "2026-10-21T10:00:00Z", false),
  ];
  expect(accuracyLine(docs, now)).toEqual({ text: "67%, up from 50%" });
});

test("accuracy is null with nothing recent, and plain with nothing before", () => {
  expect(accuracyLine([], now)).toBeNull();
  expect(
    accuracyLine([ans("s", "q", "2026-09-01T10:00:00Z", true)], now),
  ).toBeNull();
  expect(
    accuracyLine([ans("s", "q", "2026-11-03T10:00:00Z", false)], now),
  ).toEqual({
    text: "0%",
  });
});

test("due counts items whose latest answer was wrong or told", () => {
  const docs = [
    ans("s", "q1", "2026-11-01T10:00:00Z", false),
    ans("s", "q1", "2026-11-02T10:00:00Z", true),
    ans("s", "q2", "2026-11-01T10:00:00Z", true),
    ans("s", "q2", "2026-11-02T10:00:00Z", false),
    ans("s", "q3", "2026-11-02T10:00:00Z"),
    { id: "bad", data: { nope: 1 } },
  ];
  expect(dueCounts(docs).get("s")).toBe(2);
});
