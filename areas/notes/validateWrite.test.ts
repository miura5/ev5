import { expect, test } from "vitest";
import { validateWrite } from "../../data/compat-test.ts";
import { noteDoc } from "../../domain/index.ts";
import { NOTE_SOURCE, withTitle } from "./useNotes.ts";

const AT = "2026-11-04T10:15:30.000Z";
const blocks = [
  { type: "h1", runs: [{ text: "Untitled" }] },
  { type: "p", runs: [] },
];

test("a new note, a block save and a title change all pass ev4's write check", () => {
  const made = noteDoc(null, { blocks, at: AT, source: NOTE_SOURCE });
  expect(validateWrite("notes", made)).toEqual({ ok: true });
  const at = "2026-11-04T10:20:00.000Z";
  const saved = noteDoc(made, { blocks, at, source: NOTE_SOURCE });
  expect(validateWrite("notes", saved, { prev: made })).toEqual({ ok: true });
  const retitled = withTitle(saved, "Cardiac output", at);
  expect(validateWrite("notes", retitled, { prev: saved })).toEqual({ ok: true });
});
