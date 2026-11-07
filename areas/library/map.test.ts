import { expect, test } from "vitest";
import { mapLibrary } from "./map.ts";
import { goalRow, linkRow, eventRow, spotRow } from "./testHost.tsx";

const now = Date.parse("2026-11-03T18:00:00Z");
const base = {
  schema: 2,
  writer: "page",
  at: "2026-10-01T15:00:00Z",
  source: "test",
};
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
  expect(mapLibrary({ goals: [], weakspots: [], sets: [] }, now)).toEqual({
    weakSpots: [],
    exams: [],
    sets: [],
    accuracy: null,
    pages: {},
  });
});

test("exams, weak spots and sets map to the views' props; finished dates and invalid docs are skipped", () => {
  const d = mapLibrary(
    {
      goals: [
        goalRow({
          id: "e4",
          title: "Exam 4",
          kind: "unit",
          date: "2026-11-05",
        }),
        goalRow({ id: "done", status: "done", score: 0.9 }),
      ],
      weakspots: [spotRow({ id: "w1", topic: "Oral liquid doses" })],
      weakSpotEvents: [eventRow("w1", 1)],
      links: [linkRow("weak_spot", "w1", "e4")],
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
      meta: "0 missed",
      mastery: { right: 0, shaky: 0, wrong: 1 },
      due: "due today",
      goalId: "e4",
    },
  ]);
  expect(d.exams.map((e) => [e.id, e.meta, e.mastery.wrong])).toEqual([
    ["e4", "Nov 5 · in 2 days", 1],
  ]);
  expect(d.sets).toEqual([
    { id: "s1", title: "Doses", kind: "questions", meta: "1 question" },
  ]);
  expect(d.pages.s1!.items).toEqual([
    {
      id: "q1",
      front: "How many mL?",
      back: "5 mL",
      options: ["2 mL", "5 mL"],
      multi: false,
    },
  ]);
});
