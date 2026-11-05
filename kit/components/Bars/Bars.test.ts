import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Bars } from "./Bars";
import { Story } from "./Bars.story";

afterEach(cleanup);

test("bars scale against the largest, the last one is current", () => {
  const { container } = render(
    createElement(Bars, {
      label: "Minutes",
      bars: [
        { label: "Tue", value: 50 },
        { label: "Today", value: 100 },
      ],
    }),
  );
  const bars = container.querySelectorAll<HTMLElement>(".kit-bars-bar");
  expect(bars[0]?.style.height).toBe("50%");
  expect(bars[1]?.style.height).toBe("100%");
  expect(bars[1]?.className).toContain("now");
  expect(screen.getByRole("img", { name: "Minutes" })).toBeTruthy();
  expect(screen.getByText("Today")).toBeTruthy();
});

test("a ceiling scales percentages and an all-zero series does not divide by zero", () => {
  const { container } = render(
    createElement(Bars, {
      label: "Accuracy",
      max: 100,
      bars: [
        { label: "a", value: 72 },
        { label: "b", value: 0 },
      ],
    }),
  );
  const bars = container.querySelectorAll<HTMLElement>(".kit-bars-bar");
  expect(bars[0]?.style.height).toBe("72%");
  expect(bars[1]?.style.height).toBe("0%");
});

test("the story renders seven bars", () => {
  const { container } = render(createElement(Story));
  expect(container.querySelectorAll(".kit-bars-bar").length).toBe(7);
});
