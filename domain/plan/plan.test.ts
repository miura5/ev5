import { expect, test } from "vitest";
import { planEnded, lastDay, endedReason } from "./index.ts";

test("a plan has ended only when every day is before today", () => {
  expect(lastDay(["2026-11-03", "2026-11-05", "2026-11-04"])).toBe(
    "2026-11-05",
  );
  expect(planEnded(["2026-11-03", "2026-11-05"], "2026-11-06")).toBe(true);
  expect(planEnded(["2026-11-03", "2026-11-06"], "2026-11-06")).toBe(false);
  expect(planEnded([], "2026-11-06")).toBe(false);
  expect(endedReason("2026-11-05")).toMatch(/2026-11-05.*Plan again/);
});
