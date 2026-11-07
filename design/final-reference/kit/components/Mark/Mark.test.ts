import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Mark } from "./Mark";
import { Story } from "./Mark.story";

afterEach(cleanup);

test("at rest the mark is decorative", () => {
  const { container } = render(createElement(Mark, { quiet: true }));
  expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(container.querySelectorAll("path").length).toBe(5);
});

test("the mark stands still: no step, arrive or progress modes", () => {
  const { container } = render(createElement(Story));
  expect(container.querySelectorAll(".kit-mark").length).toBe(3);
  expect(container.querySelectorAll(".kit-mark-progress, .kit-mark-arrive, [data-part], [role=img]").length).toBe(0);
});
