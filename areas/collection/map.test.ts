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
  expect(d.items[0]!.title).toBe("k1");
});

test("no collections is the empty state", () => {
  expect(mapCollection([], [])).toBeUndefined();
});

test("an id opens that collection, with its parent id for Back", () => {
  const cs = [
    { id: "a", title: "NUR 112", parentId: null, pos: 0 },
    { id: "b", title: "Labs", parentId: "a", pos: 1 },
  ];
  const ms = [{ collection: "notes", id: "n1", collectionId: "b", at: 1 }];
  const d = mapCollection(cs, ms, "b")!;
  expect(d.title).toBe("Labs");
  expect(d.parentId).toBe("a");
  expect(d.items).toHaveLength(1);
  expect(mapCollection(cs, ms, "zzz")!.title).toBe("NUR 112");
});

test("members show the item's title and date, falling back to the id", () => {
  const nov3 = Date.UTC(2026, 10, 3, 18);
  const d = mapCollection(cs, ms, "a", {
    notes: [{ id: "n1", at: nov3, data: { title: "  Heart sounds " } }],
  })!;
  const byId = Object.fromEntries(d.items.map((e) => [e.id, e]));
  expect(byId.n1).toMatchObject({ title: "Heart sounds", meta: "notes · Nov 3" });
  expect(byId.k1!.title).toBe("k1");
  expect(byId.k1!.meta).toMatch(/^cards · /);
});
