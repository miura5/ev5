import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  expect(
    screen.getByRole("radio", { name: /Alpha/ }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.getByText("2")).toBeTruthy();
  fireEvent.click(screen.getByText("Beta"));
  expect(onChange).toHaveBeenCalledWith("b");
});

test("the story switches the lit option", () => {
  render(createElement(Story));
  fireEvent.click(screen.getByText("Learn"));
  expect(
    screen.getByRole("radio", { name: "Learn" }).getAttribute("aria-checked"),
  ).toBe("true");
});

test("one Tab stop per group and arrows move focus", async () => {
  render(
    createElement(
      "div",
      null,
      createElement(TextOptions, {
        options,
        value: "a",
        onChange: vi.fn(),
        label: "Pick",
      }),
    ),
  );
  const radios = screen.getAllByRole("radio");
  // Before focus the group itself is the one stop and no option is; it hands focus to the lit option.
  expect(screen.getByRole("radiogroup").tabIndex).toBe(0);
  expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(0);
  const on = screen.getByRole("radio", { name: /Alpha/ });
  on.focus();
  fireEvent.keyDown(on, { key: "ArrowRight" });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Beta" })));
  expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
});
