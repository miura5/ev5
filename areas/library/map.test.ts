import { expect, test } from "vitest";
import { mapLibrary } from "./map.ts";

const now = Date.parse("2026-11-03T18:00:00Z");
const base = {
  schema: 2,
  writer: "page",
  at: "2026-10-01T15:00:00Z",
  source: "test",
};
const exam = {
  ...base,
  title: "Exam 4",
  kind: "unit",
  date: "2026-11-05",
  course: "NUR 112",
};
const spot = (topic: string) => ({
  ...base,
  topic,
  objective: "E4-3",
  exam: "e4",
  kind: "concept",
  initial: { streak: 0, nextDue: "2026-11-03", recurrence: 1, misses: 2 },
  events: {},
});
const set = {
  ...base,
  schema: 3,
  kind: "drill",
  title: "Doses",
  items: [
    { id: "q1", stem: "How many mL?", options: ["2 mL", "5 mL"], correct: [1] },
  ],
};

test("no data gives empty lists", () => {
  expect(mapLibrary({ exams: [], weakspots: [], sets: [] }, now)).toEqual({
    weakSpots: [],
    exams: [],
    sets: [],
    pages: {},
  });
});

test("exams, weak spots and sets map to the views' props; invalid docs are skipped", () => {
  const d = mapLibrary(
    {
      exams: [
        { id: "e4", data: exam },
        { id: "bad", data: { nope: 1 } },
      ],
      weakspots: [{ id: "w1", data: spot("Oral liquid doses") }],
      sets: [
        { id: "s1", data: set },
        { id: "s2", data: { nope: 1 } },
      ],
    },
    now,
  );
  expect(d.weakSpots).toEqual([
    {
      id: "w1",
      title: "Oral liquid doses",
      meta: "2 missed",
      mastery: { right: 0, shaky: 0, wrong: 1 },
      due: "due today",
    },
  ]);
  expect(d.exams.map((e) => [e.id, e.meta, e.mastery.wrong])).toEqual([
    ["e4", "NUR 112 · Nov 5 · in 2 days", 1],
  ]);
  expect(d.sets).toEqual([
    { id: "s1", title: "Doses", kind: "questions", meta: "1 question" },
  ]);
  expect(d.pages.s1!.items).toEqual([
    { id: "q1", front: "How many mL?", back: "5 mL" },
  ]);
});
