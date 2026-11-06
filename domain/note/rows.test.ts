import { expect, test } from "vitest";
import { parseNote } from "./parse.ts";
import { newNoteRow, noteDocOf, noteRowId, noteText } from "./rows.ts";
import { parseNoteTableRow } from "./table.ts";

const T0 = "2026-10-18T15:00:00.000Z";
const doc = parseNote({
  schema: 1,
  writer: "page",
  at: T0,
  source: "E.V. Home",
  createdAt: "2026-10-17T09:00:00.000Z",
  title: "Fluids",
  course: "Biology 101",
  label: "week 4",
  editedAt: T0,
  earlierOf: "n-20261017-090000-abcdefgh",
  archivedAt: "2026-10-19T00:00:00.000Z",
  blocks: [
    { type: "h1", runs: [{ text: "Fluids" }] },
    {
      type: "p",
      runs: [{ text: "Sodium is " }, { text: "135-145", b: true }],
    },
    { type: "p", runs: [], row: "r1", col: 1 },
    {
      type: "img",
      runs: [],
      key: "note-images/abcdefghijklmnop.png",
      width: 300,
      alt: "chart",
    },
  ],
});

test("a note becomes a row whose text is the words, and reads back as the same document", () => {
  const row = newNoteRow("n-1", doc, "col_a");
  expect(row.id).toBe("note_n-1");
  expect(row.collection_id).toBe("col_a");
  expect(row.title).toBe("Fluids");
  expect(row.text).toBe("Fluids\nSodium is 135-145\n\n");
  expect(row.earlier_of).toBe("note_n-20261017-090000-abcdefgh");
  const stored = parseNoteTableRow({
    ...row,
    at: Date.parse("2026-10-20T00:00:00.000Z"),
    v: 3,
    deleted_at: null,
  });
  const back = noteDocOf(stored);
  // nothing is dropped: the blocks and every mark survive; only the envelope's `at` is the row's own
  expect({ ...back, at: T0 }).toEqual(doc);
  expect(back.at).toBe("2026-10-20T00:00:00.000Z");
});

test("a note past the 256 KB budget has no row", () => {
  const big = {
    ...doc,
    blocks: Array.from({ length: 30 }, () => ({
      type: "p" as const,
      runs: [{ text: "x".repeat(10000) }],
    })),
  };
  expect(() => newNoteRow("n-2", big, null)).toThrow(/at most/);
});

test("ids and text helpers", () => {
  expect(noteRowId("n-3")).toBe("note_n-3");
  expect(noteText([])).toBe("");
});
