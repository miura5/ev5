import { expect, test } from "vitest";
import { parseObjective } from "./index.ts";

const base = {
  schema: 1,
  writer: "worker",
  at: "2026-11-03T00:00:00Z",
  source: "t",
  exam: "E4",
  text: "Explain X",
} as const;

test("parses a valid objective and rejects what the schema refuses", () => {
  expect(parseObjective({ ...base, num: 2, chapters: [1, "a"] }).num).toBe(2);
  expect(parseObjective({ ...base, chapters: "3-4" }).text).toBe("Explain X");
  expect(() => parseObjective({ ...base, text: "" })).toThrow();
  expect(() => parseObjective({ ...base, exam: undefined })).toThrow();
  expect(() => parseObjective({ ...base, num: -1 })).toThrow();
  expect(() => parseObjective({ ...base, writer: "canvas-sync" })).toThrow();
  expect(() => parseObjective({ ...base, extra: 1 })).toThrow();
  expect(() => parseObjective({ ...base, chapters: [1.5] })).toThrow();
});
