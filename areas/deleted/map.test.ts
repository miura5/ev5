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
      { collection: "own_set_items", id: "s1/i1", at, title: "Which lab is highest priority?" },
      { collection: "notes", id: "n9", at: at - 1, title: null },
    ],
    at,
  );
  expect(out[0]).toMatchObject({ title: "Which lab is highest priority?", kind: "Set question" });
  expect(out[1]).toMatchObject({ title: "Untitled", kind: "Note" });
  expect(JSON.stringify(out.map((i) => [i.title, i.kind]))).not.toMatch(/own_set_items|n9|s1\/i1/);
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
