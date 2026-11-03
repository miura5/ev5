import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TextOptions } from "./TextOptions";
import { Story } from "./TextOptions.story";

afterEach(cleanup);

const options = [
  { value: "a", label: "Alpha", count: 2 },
  { value: "b", label: "Beta" },
];

test("the chosen option is pressed and a click reports the other", () => {
  const onChange = vi.fn();
  render(
    createElement(TextOptions, {
      options,
      value: "a",
      onChange,
      label: "Pick",
    }),
  );
  expect(screen.getByText("Alpha").closest("button")?.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("2")).toBeTruthy();
  fireEvent.click(screen.getByText("Beta"));
  expect(onChange).toHaveBeenCalledWith("b");
});

test("the story switches the lit option", () => {
  render(createElement(Story));
  fireEvent.click(screen.getByText("Learn"));
  expect(screen.getByText("Learn").getAttribute("aria-pressed")).toBe("true");
});
