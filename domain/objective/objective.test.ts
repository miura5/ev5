import { expect, test } from "vitest";
import {
  parseObjective,
  sameCourse,
  objectivesOf,
  newCheckIds,
  candidateObjectives,
  withObjective,
} from "./index.ts";

const base = {
  schema: 1,
  writer: "worker",
  at: "2026-11-03T00:00:00Z",
  source: "t",
  exam: "E4",
  text: "Explain X",
} as const;

test("parses a valid objective and rejects what the frozen schema refuses", () => {
  expect(parseObjective({ ...base, num: 2, chapters: [1, "a"] }).num).toBe(2);
  expect(parseObjective({ ...base, chapters: "3-4" }).text).toBe("Explain X");
  expect(() => parseObjective({ ...base, text: "" })).toThrow();
  expect(() => parseObjective({ ...base, exam: undefined })).toThrow();
  expect(() => parseObjective({ ...base, num: -1 })).toThrow();
  expect(() => parseObjective({ ...base, writer: "canvas-sync" })).toThrow();
  expect(() => parseObjective({ ...base, extra: 1 })).toThrow();
  expect(() => parseObjective({ ...base, chapters: [1.5] })).toThrow();
});

const exams = [
  { id: "E4", course: "NUR 112" },
  { id: "E5", course: "NUR 112" },
  { id: "D1", course: "NUR 112" },
  { id: "BX3", course: "BIO 201" },
];
const objectives = [
  { id: "E4-1", exam: "E4" },
  { id: "E4-2", exam: "E4" },
  { id: "BX3-1", exam: "BX3" },
];

test("new checks: the exam objectives in order, minus active ones, capped", () => {
  expect(objectivesOf(objectives, "E4").map((o) => o.id)).toEqual([
    "E4-1",
    "E4-2",
  ]);
  expect(newCheckIds(objectives, "E4", ["E4-1"], 3)).toEqual(["E4-2"]);
  expect(newCheckIds(objectives, "E4", [], 1)).toEqual(["E4-1"]);
});

test("candidates: the exam own, else its course, a course alone, everything, or none", () => {
  const ids = (ctx: Parameters<typeof candidateObjectives>[0]) =>
    candidateObjectives({ objectives, exams, ...ctx }).map((o) => o.id);
  expect(ids({ exam: exams[0], course: "NUR 112" })).toEqual(["E4-1", "E4-2"]);
  expect(ids({ exam: exams[2], course: "NUR 112" })).toEqual(["E4-1", "E4-2"]);
  expect(ids({ exam: exams[1], course: "nur112" })).toEqual(["E4-1", "E4-2"]);
  expect(ids({ course: "BIO 201" })).toEqual(["BX3-1"]);
  expect(ids({})).toEqual(["E4-1", "E4-2", "BX3-1"]);
  expect(ids({ course: "NUR 113" })).toEqual([]);
  expect(ids({ exam: exams[2] })).toEqual([]);
  expect(sameCourse("nur 112", "NUR112")).toBe(true);
});

test("an item objective is held to its candidates", () => {
  expect(withObjective({ objective: "D1-2" }, ["D1-1", "D1-2"]).objective).toBe(
    "D1-2",
  );
  expect(withObjective({ objective: "E4-3" }, ["D1-1"]).objective).toBe("D1-1");
  expect(withObjective<{ objective?: string }>({}, ["D1-1"]).objective).toBe(
    "D1-1",
  );
  expect(
    "objective" in withObjective({ objective: "E4-3" }, ["D1-1", "D1-2"]),
  ).toBe(false);
  expect("objective" in withObjective({ objective: "E4-3" }, [])).toBe(false);
});
