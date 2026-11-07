import { expect, test } from "vitest";
import { mapDeletions } from "./map.ts";

const at = Date.UTC(2026, 10, 1, 12);

test("maps newest first with days left", () => {
  const out = mapDeletions(
    [
      { collection: "cards", id: "k", at: at - 86_400_000 },
      { collection: "notes", id: "n", at },
    ],
    at + 3 * 86_400_000,
  );
  expect(out.map((i) => i.title)).toEqual(["Untitled", "Untitled"]);
  expect(out[0]).toMatchObject({
    id: "notes/n",
    type: "note",
    deletedOn: "Nov 1",
    daysLeft: 27,
  });
  expect(out[1]?.type).toBe("cards");
});

test("rows show the title and a plain kind, never an id or a table name", () => {
  const out = mapDeletions(
    [
      {
        collection: "set_items",
        id: "i1",
        at,
        title: "Which lab is highest priority?",
      },
      { collection: "notes", id: "n9", at: at - 1, title: null },
    ],
    at,
  );
  expect(out[0]).toMatchObject({
    title: "Which lab is highest priority?",
    kind: "Set question",
  });
  expect(out[1]).toMatchObject({ title: "Untitled", kind: "Note" });
  expect(JSON.stringify(out.map((i) => [i.title, i.kind]))).not.toMatch(
    /set_items|n9|i1/,
  );
});

test("a set item on the sets tables reads as a Set question, and a set as a Set", () => {
  const out = mapDeletions(
    [
      { collection: "set_items", id: "item_1", at, title: "Which lab?" },
      { collection: "sets", id: "set_1", at: at - 1, title: "Cycles" },
    ],
    at,
  );
  expect(out.map((i) => [i.type, i.kind])).toEqual([
    ["questions", "Set question"],
    ["note", "Set"],
  ]);
});

test("days left never go below zero; none is empty", () => {
  expect(
    mapDeletions(
      [{ collection: "notes", id: "n", at }],
      at + 99 * 86_400_000,
    )[0]?.daysLeft,
  ).toBe(0);
  expect(mapDeletions([], at)).toEqual([]);
});

test("items deleted on the same Central day have the same days left, whatever the hour", () => {
  const nov4Early = Date.UTC(2026, 10, 4, 7); // 01:00 Central
  const nov4Late = Date.UTC(2026, 10, 5, 4); // 22:00 Central, still Nov 4
  const now = Date.UTC(2026, 10, 5, 17); // Nov 5 Central
  const out = mapDeletions(
    [
      { collection: "notes", id: "a", at: nov4Early },
      { collection: "notes", id: "b", at: nov4Late },
    ],
    now,
  );
  expect(out.map((i) => i.daysLeft)).toEqual([29, 29]);
});

test("a deleted collection shows the folder icon", () => {
  expect(
    mapDeletions([{ collection: "collections", id: "c", at }], at)[0],
  ).toMatchObject({
    type: "collection",
    kind: "Collection",
  });
});
