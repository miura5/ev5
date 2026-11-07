import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Dot, DOT_TONES } from "./Dot";
import { Story } from "./Dot.story";

afterEach(cleanup);

test("a dot carries its tone", () => {
  for (const tone of DOT_TONES) {
    const { container } = render(createElement(Dot, { tone }));
    expect(
      container.querySelector("[data-ui=dot]")?.getAttribute("data-tone"),
    ).toBe(tone);
    cleanup();
  }
});

test("a labelled dot is named and a plain one is hidden from readers", () => {
  const { container } = render(
    createElement(
      "div",
      null,
      createElement(Dot, { tone: "ok", label: "Ready" }),
      createElement(Dot, { tone: "bad" }),
    ),
  );
  expect(screen.getByRole("img", { name: "Ready" })).toBeTruthy();
  expect(container.querySelectorAll("[aria-hidden=true]")).toHaveLength(1);
});

test("the story shows every tone", () => {
  const { container } = render(createElement(Story));
  expect(container.querySelectorAll("[data-ui=dot]")).toHaveLength(
    DOT_TONES.length,
  );
});

test("a pulsing dot marks running work", () => {
  const { container } = render(createElement(Dot, { tone: "faint", pulse: true, label: "Running" }));
  expect(container.querySelector("[data-ui=dot]")?.hasAttribute("data-pulse")).toBe(true);
  expect(screen.getByRole("img", { name: "Running" })).toBeTruthy();
});
