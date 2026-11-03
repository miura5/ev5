import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { GLYPH_TYPES, Glyph } from "./Glyph";
import { Story } from "./Glyph.story";

afterEach(cleanup);

test("there are eight glyphs and each draws a path, hidden from assistive tech", () => {
  expect(GLYPH_TYPES.length).toBe(8);
  for (const type of GLYPH_TYPES) {
    const { container } = render(createElement(Glyph, { type }));
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelector("path")?.getAttribute("d")).toBeTruthy();
    cleanup();
  }
});

test("done fills the plan ring with a tick; running spins only the job ring", () => {
  const done = render(
    createElement(Glyph, { type: "plan", done: true }),
  ).container;
  expect(done.querySelector(".kit-glyph-fill")).toBeTruthy();
  expect(done.querySelector(".kit-glyph-tick")).toBeTruthy();
  cleanup();
  const plain = render(
    createElement(Glyph, { type: "note", done: true, running: true }),
  ).container;
  expect(plain.querySelector(".kit-glyph-fill")).toBeNull();
  expect(plain.querySelector(".kit-glyph-run")).toBeNull();
  cleanup();
  const job = render(
    createElement(Glyph, { type: "job", running: true }),
  ).container;
  expect(job.querySelector(".kit-glyph-run")).toBeTruthy();
});

test("the story renders ten glyphs", () => {
  const { container } = render(createElement(Story));
  expect(container.querySelectorAll("svg").length).toBe(10);
});
