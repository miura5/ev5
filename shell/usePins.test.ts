import { expect, test } from "vitest";
import { sidebarPins, type PinWire } from "./usePins.ts";

const NOW = Date.UTC(2026, 10, 2, 18); // Mon Nov 2, Central
const exam = (date: string) => ({
  schema: 2,
  writer: "page",
  at: "2026-11-01T00:00:00Z",
  source: "test",
  title: "Exam",
  kind: "exam",
  date,
  status: "upcoming",
});
const wire: PinWire = {
  pins: [
    { collection: "collections", id: "bio" },
    { collection: "collections", id: "run" },
    { collection: "collections", id: "none" },
    { collection: "notes", id: "n1" },
  ],
  collections: [
    { id: "bio", title: "Biology", parentId: null },
    { id: "bio-lab", title: "Lab", parentId: "bio" },
    { id: "run", title: "Running", parentId: null },
    { id: "none", title: "Spanish", parentId: null },
  ],
  memberships: [
    { collection: "exams", id: "e1", collectionId: "bio" },
    { collection: "exams", id: "e2", collectionId: "bio-lab" },
    { collection: "exams", id: "e3", collectionId: "run" },
    { collection: "exams", id: "old", collectionId: "none" },
  ],
  docs: {
    exams: [
      { id: "e1", data: exam("2026-11-20") },
      { id: "e2", data: exam("2026-11-05") },
      { id: "e3", data: exam("2026-12-14") },
      { id: "old", data: exam("2026-10-01") },
    ],
    notes: [{ id: "n1", data: { title: "Heart" } }],
  },
};

test("a pinned collection shows the day of its next linked date, nested ones included", () => {
  const out = sidebarPins(wire, NOW);
  expect(out.map((p) => [p.title, p.when])).toEqual([
    ["Biology", "Thu"],
    ["Running", "Dec 14"],
    ["Spanish", undefined],
    ["Heart", undefined],
  ]);
  expect(out[0]?.to).toBe("/collection/bio");
  expect(out[3]?.to).toBe("/notes?open=n1");
});
