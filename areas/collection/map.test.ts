import { expect, test } from "vitest";
import { mapCollection, mapPins } from "./map.ts";

const cs = [
  { id: "b", title: "Economics 101", parentId: null, pos: 2, v: 1 },
  { id: "a", title: "Course A", parentId: null, pos: 1, v: 1 },
  { id: "s", title: "Labs", parentId: "a", pos: 1, v: 1 },
];
const ms = [
  { collection: "notes", id: "n1", collectionId: "a", at: 1, v: 1 },
  { collection: "cards", id: "k1", collectionId: "a", at: 5, v: 1 },
  { collection: "notes", id: "n2", collectionId: "b", at: 9, v: 1 },
];

test("picks the first top-level collection with its nested and members, newest first", () => {
  const d = mapCollection(cs, ms)!;
  expect(d.title).toBe("Course A");
  expect(d.nested.map((e) => e.title)).toEqual(["Labs"]);
  expect(d.items.map((e) => [e.id, e.type])).toEqual([
    ["k1", "cards"],
    ["n1", "note"],
  ]);
  expect(d.items[0]!.title).toBe("Untitled");
});

test("no collections is the empty state", () => {
  expect(mapCollection([], [])).toBeUndefined();
});

test("an id opens that collection, with its parent id for Back", () => {
  const cs = [
    { id: "a", title: "Course A", parentId: null, pos: 0, v: 1 },
    { id: "b", title: "Labs", parentId: "a", pos: 1, v: 1 },
  ];
  const ms = [
    { collection: "notes", id: "n1", collectionId: "b", at: 1, v: 1 },
  ];
  const d = mapCollection(cs, ms, "b")!;
  expect(d.title).toBe("Labs");
  expect(d.parentId).toBe("a");
  expect(d.items).toHaveLength(1);
  expect(mapCollection(cs, ms, "zzz")!.title).toBe("Course A");
});

test("members show the item's title and date, falling back to Untitled", () => {
  const nov3 = Date.UTC(2026, 10, 3, 18);
  const d = mapCollection(cs, ms, "a", {
    notes: [{ id: "note_n1", at: nov3, title: "  Heart sounds " }],
  })!;
  const byId = Object.fromEntries(d.items.map((e) => [e.id, e]));
  expect(byId.n1).toMatchObject({
    title: "Heart sounds",
    meta: "Note · Nov 3",
    to: "/notes?open=n1",
  });
  expect(byId.k1!.title).toBe("Untitled");
  expect(byId.k1!.meta).toMatch(/^Cards · /);
  expect(byId.k1!.to).toBeUndefined();
});

test("pins keep the server order and are named from docs, else Untitled", () => {
  const e = mapPins(
    [
      { collection: "notes", id: "n1", pos: 0, at: 2 },
      { collection: "cards", id: "k1", pos: 1, at: 1 },
    ],
    { notes: [{ id: "note_n1", title: "Heart" }] },
  );
  expect(e.map((x) => [x.title, x.type])).toEqual([
    ["Heart", "note"],
    ["Untitled", "cards"],
  ]);
});
