import { expect, test } from "vitest";
import { entryPath } from "./App.tsx";

test("the bare root opens Today; every other path is kept", () => {
  expect(entryPath("/")).toBe("/today");
  expect(entryPath("/ask")).toBe("/ask");
  expect(entryPath("/today")).toBe("/today");
});
