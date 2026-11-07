import { expect, test } from "vitest";
import { sidebarPins, type PinWire } from "./usePins.ts";

const NOW = Date.UTC(2026, 10, 2, 18); // Mon Nov 2, Central
const goal = (
  id: string,
  collection_id: string,
  date: string,
  status = "open",
) => ({
  id,
  title: "Exam",
  collection_id,
  date,
  status,
});
const wire: PinWire = {
  pins: [
    { collection: "collections", id: "bio" },
    { collection: "collections", id: "run" },
    { collection: "collections", id: "none" },
    { collection: "notes", id: "n1" },
    { collection: "sets", id: "set_s1" },
    { collection: "exams", id: "goal_e1" },
    { collection: "notes", id: "gone" },
  ],
  collections: [
    { id: "bio", title: "Biology", parentId: null },
    { id: "bio-lab", title: "Lab", parentId: "bio" },
    { id: "run", title: "Running", parentId: null },
    { id: "none", title: "Spanish", parentId: null },
  ],
  goals: [
    goal("goal_e1", "bio", "2026-11-20"),
    goal("goal_e2", "bio-lab", "2026-11-05"),
    goal("goal_e3", "run", "2026-12-14"),
    goal("goal_old", "none", "2026-10-01"),
    goal("goal_done", "none", "2026-11-03", "done"),
  ],
  titles: {
    notes: [{ id: "note_n1", title: "Heart" }],
    sets: [{ id: "set_s1", title: "Cardiac" }],
  },
};

test("a pinned collection shows the day of its next linked date, nested ones included", () => {
  const out = sidebarPins(wire, NOW);
  expect(out.map((p) => [p.title, p.when])).toEqual([
    ["Biology", "Thu"],
    ["Running", "Dec 14"],
    ["Spanish", undefined],
    ["Heart", undefined],
    ["Cardiac", undefined],
    ["Exam", undefined],
    ["Untitled", undefined],
  ]);
  expect(out[0]?.to).toBe("/collection/bio");
  expect(out[3]?.to).toBe("/notes?open=n1");
});
