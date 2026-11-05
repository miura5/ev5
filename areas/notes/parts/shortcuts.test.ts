import { expect, test } from "vitest";
import src from "./editorKeys.ts?raw";
import { SHORTCUTS } from "./shortcuts.ts";

const keymapBlock = src.slice(
  src.indexOf("keymap({") + 8,
  src.indexOf("keymap(baseKeymap)"),
);
const keys = [...keymapBlock.matchAll(/^\s+(?:'([\w-]+)'|(\w+)):/gm)]
  .map((m) => m[1] ?? m[2] ?? "")
  .filter((k) => k !== "Enter" && k !== "Backspace");
const rules = [...src.matchAll(/rule\(\/(.+?)\/,/g)].map((m) => m[1]);

test("every key and typing rule in the editor is listed, and nothing else", () => {
  const listed = SHORTCUTS.map((s) => s.bind);
  const lower = (k?: string) => (k ?? "").toLowerCase();
  expect(keys.length).toBeGreaterThan(5);
  expect(rules).toHaveLength(6);
  for (const k of keys) expect(listed.map(lower)).toContain(lower(k));
  for (const r of rules) expect(listed).toContain(r);
  expect(listed).toHaveLength(keys.length + rules.length);
});

test("the keys read as Mac or other", () => {
  const bold = SHORTCUTS.find((s) => s.bind === "Mod-b");
  expect(bold?.shown(true)).toBe("⌘B");
  expect(bold?.shown(false)).toBe("Ctrl+B");
});
