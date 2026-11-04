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
  expect(out.map((i) => i.title)).toEqual(["n", "k"]);
  expect(out[0]).toMatchObject({
    id: "notes/n",
    type: "note",
    deletedOn: "Nov 1",
    daysLeft: 27,
  });
  expect(out[1]?.type).toBe("cards");
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
