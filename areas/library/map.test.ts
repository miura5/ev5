import { expect, test } from "vitest";
import { mapLibrary } from "./map.ts";
import {
  goalRow,
  itemRow,
  linkRow,
  eventRow,
  setRow,
  spotRow,
} from "./testHost.tsx";

const now = Date.parse("2026-11-03T18:00:00Z");
const items = [
  itemRow("item_q1", "set_s1", {
    stem: "How many mL?",
    options: ["2 mL", "5 mL"],
    correct: [1],
  }),
  // a body with no stem is left out, never an error on Library
  itemRow("item_bad", "set_s1", { nope: 1 }, { pos: 2 }),
];

test("no data gives empty lists", () => {
  expect(mapLibrary({ goals: [], weakspots: [], sets: [] }, now)).toEqual({
    weakSpots: [],
    exams: [],
    sets: [],
    accuracy: null,
    pages: {},
  });
});

test("exams, weak spots and sets map to the views' props; finished dates and bodiless items are skipped", () => {
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
      sets: [setRow({ id: "set_s1" })],
      items,
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
    { id: "set_s1", title: "Doses", kind: "questions", meta: "1 question" },
  ]);
  expect(d.pages.set_s1!.items).toEqual([
    {
      id: "item_q1",
      front: "How many mL?",
      back: "5 mL",
      options: ["2 mL", "5 mL"],
      multi: false,
    },
  ]);
});
