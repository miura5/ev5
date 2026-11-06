import { expect, test } from "vitest";
import { DATE_KINDS, kindOffers, toolsForKind } from "./index.ts";

test("exam offers the prep plan and its weak-spot links; other, the default, offers weak-spot links only", () => {
  expect(toolsForKind("exam")).toEqual(["prep-plan", "weak-spot-links"]);
  expect(toolsForKind("other")).toEqual(["weak-spot-links"]);
  expect(kindOffers("other", "prep-plan")).toBe(false);
  expect(Object.keys(DATE_KINDS)).toEqual(["exam", "other"]);
});

test("an unknown kind is still a date and offers nothing", () => {
  expect(toolsForKind("quiz")).toEqual([]);
  expect(toolsForKind("toString")).toEqual([]);
  expect(kindOffers("quiz", "prep-plan")).toBe(false);
  expect(kindOffers("exam", "prep-plan")).toBe(true);
});
