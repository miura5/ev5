import { expect, test } from "vitest";
import { mapCollection } from "./map.ts";

const cs = [
  { id: "b", title: "BIO 201", parentId: null, pos: 2 },
  { id: "a", title: "NUR 112", parentId: null, pos: 1 },
  { id: "s", title: "Labs", parentId: "a", pos: 1 },
];
const ms = [
  { collection: "notes", id: "n1", collectionId: "a", at: 1 },
  { collection: "cards", id: "k1", collectionId: "a", at: 5 },
  { collection: "notes", id: "n2", collectionId: "b", at: 9 },
];

test("picks the first top-level collection with its nested and members, newest first", () => {
  const d = mapCollection(cs, ms)!;
  expect(d.title).toBe("NUR 112");
  expect(d.nested.map((e) => e.title)).toEqual(["Labs"]);
  expect(d.items.map((e) => [e.id, e.type])).toEqual([
    ["k1", "cards"],
    ["n1", "note"],
  ]);
});

test("no collections is the empty state", () => {
  expect(mapCollection([], [])).toBeUndefined();
});
