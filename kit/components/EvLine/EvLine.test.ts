import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { EvLine } from "./EvLine";
import { Story } from "./EvLine.story";

afterEach(cleanup);

test("the line shows her words beside a mark hidden from assistive tech", () => {
  const { container } = render(
    createElement(EvLine, null, "Start with Photosynthesis?"),
  );
  expect(screen.getByText("Start with Photosynthesis?")).toBeTruthy();
  const mark = container.querySelector(".kit-evmark");
  expect(mark?.getAttribute("aria-hidden")).toBe("true");
  expect(mark?.classList.contains("kit-evmark-quiet")).toBe(false);
});

test("quiet greys the mark so the orange can go elsewhere", () => {
  const { container } = render(
    createElement(EvLine, { quiet: true, children: "Hi" }),
  );
  expect(container.querySelector(".kit-evmark-quiet")).toBeTruthy();
});

test("the story renders two lines", () => {
  const { container } = render(createElement(Story));
  expect(container.querySelectorAll("[data-ui='ev-line']").length).toBe(2);
});
