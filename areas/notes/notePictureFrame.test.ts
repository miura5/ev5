import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dirname, "notes.css"), "utf8");
const rule = (sel: string) => new RegExp(`${sel.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";

test("a picture frame hugs its picture, up to the column width", () => {
  const frame = rule(".ev-notes-pic");
  expect(frame).toMatch(/width:\s*fit-content/);
  expect(frame).toMatch(/max-width:\s*100%/);
});
