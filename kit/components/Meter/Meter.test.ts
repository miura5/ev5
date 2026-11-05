import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Meter } from "./Meter";
import { Story } from "./Meter.story";

afterEach(cleanup);

test("a meter is found by its words and draws one part per non-empty tone", () => {
  const { container } = render(
    createElement(Meter, {
      label: "Learned 6, weak 0, familiar 3",
      parts: [
        { tone: "ok", count: 6 },
        { tone: "warn", count: 3 },
        { tone: "bad", count: 0 },
      ],
    }),
  );
  expect(
    screen.getByRole("img", { name: "Learned 6, weak 0, familiar 3" }),
  ).toBeTruthy();
  const parts = [...container.querySelectorAll("i")];
  expect(parts.map((p) => p.getAttribute("data-tone"))).toEqual(["ok", "warn"]);
  expect(parts.map((p) => p.style.getPropertyValue("--part"))).toEqual([
    "6",
    "3",
  ]);
});

test("an empty meter is still named", () => {
  render(createElement(Meter, { label: "Nothing studied yet", parts: [] }));
  expect(screen.getByRole("img", { name: "Nothing studied yet" })).toBeTruthy();
});

test("the story shows each state with a name", () => {
  render(createElement(Story));
  expect(screen.getAllByRole("img")).toHaveLength(4);
});
