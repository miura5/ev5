import { expect, test } from "vitest";
import { DATE_KINDS, kindOffers, toolsForKind } from "./index.ts";

test("exam offers the study plan and its weak-spot links; the registry has no other kind yet", () => {
  expect(toolsForKind("exam")).toEqual(["study-plan", "weak-spot-links"]);
  expect(Object.keys(DATE_KINDS)).toEqual(["exam"]);
});

test("an unknown kind is still a date and offers nothing", () => {
  expect(toolsForKind("quiz")).toEqual([]);
  expect(toolsForKind("toString")).toEqual([]);
  expect(kindOffers("quiz", "study-plan")).toBe(false);
  expect(kindOffers("exam", "study-plan")).toBe(true);
});
