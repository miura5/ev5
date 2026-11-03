import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const css = readFileSync("kit/tokens/tokens.css", "utf8");
const mock = readFileSync("design/mockup.html", "utf8");

/** Custom properties declared in a block of CSS, with whitespace removed. */
function props(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g))
    out[m[1]] = m[2].replace(/\s+/g, "").toLowerCase();
  return out;
}

function between(src: string, start: RegExp, end: RegExp): string {
  const s = src.search(start);
  const rest = src.slice(s);
  return rest.slice(0, rest.search(end));
}

const dark = props(between(css, /:root,\s*\n\[data-theme="dark"\]/, /\n\}/));
const light = props(between(css, /\n\[data-theme="light"\]/, /\n\}/));

// Every colour the mock-up defines twice (dark, then light) must match in both themes.
const mockPairs = new Map<string, string[]>();
for (const m of mock.matchAll(
  /(--[a-z0-9-]+)\s*:\s*((?:#[0-9a-f]{3,8}|rgba?\([^)]*\)|[0-9]+px [^;]*rgba[^;]*))\s*;/gi,
)) {
  const list = mockPairs.get(m[1]) ?? [];
  list.push(
    m[2]
      .replace(/\s+/g, "")
      .toLowerCase()
      .replace(/(\D)\.(\d)/g, "$10.$2"),
  );
  mockPairs.set(m[1], list);
}

test("tokens.css colours equal the mock-up's, dark and light", () => {
  const themed = [...mockPairs].filter(([, v]) => v.length === 2);
  expect(themed.length).toBeGreaterThan(15);
  for (const [name, [d, l]] of themed) {
    expect(dark[name], `${name} dark`).toBe(d);
    expect(light[name], `${name} light`).toBe(l);
  }
});

test("type has three text sizes plus the one face exception", () => {
  const sizes = Object.entries(props(css)).filter(([k]) =>
    k.startsWith("--fs-"),
  );
  expect(Object.fromEntries(sizes)).toEqual({
    "--fs-meta": "12px",
    "--fs-body": "14px",
    "--fs-title": "20px",
    "--fs-face": "24px",
  });
});
