import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Field, Segmented } from "./Field";
import { Story } from "./Field.story";

afterEach(cleanup);

test("a field is found by its label", () => {
  render(createElement(Field, { label: "Title", defaultValue: "Heparin" }));
  expect(
    (screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value,
  ).toBe("Heparin");
});

test("a segmented choice marks one option on and reports a tap", () => {
  const onChange = vi.fn();
  render(
    createElement(Segmented, {
      label: "How many",
      options: ["3", "5"],
      value: "3",
      onChange,
    }),
  );
  expect(
    screen.getByRole("radio", { name: "3" }).getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("radio", { name: "5" }));
  expect(onChange).toHaveBeenCalledWith("5");
});

test("the story moves the choice", () => {
  render(createElement(Story));
  fireEvent.click(screen.getByRole("radio", { name: "8" }));
  expect(
    screen.getByRole("radio", { name: "8" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(
    screen.getByRole("radio", { name: "5" }).getAttribute("aria-checked"),
  ).toBe("false");
});

test("tapping the lit option keeps it on and reports nothing", () => {
  const onChange = vi.fn();
  render(
    createElement(Segmented, {
      label: "How many",
      options: ["3", "5"],
      value: "3",
      onChange,
    }),
  );
  fireEvent.click(screen.getByRole("radio", { name: "3" }));
  expect(onChange).not.toHaveBeenCalled();
});

test("one Tab stop per group and arrows move focus", async () => {
  render(
    createElement(
      "div",
      null,
      createElement(Segmented, {
        label: "How many",
        options: ["3", "5", "8"],
        value: "5",
        onChange: vi.fn(),
      }),
    ),
  );
  const radios = screen.getAllByRole("radio");
  // Before focus the group itself is the one stop and no option is; it hands focus to the lit option.
  expect(screen.getByRole("radiogroup").tabIndex).toBe(0);
  expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(0);
  const on = screen.getByRole("radio", { name: "5" });
  on.focus();
  fireEvent.keyDown(on, { key: "ArrowRight" });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("radio", { name: "8" })));
  expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
});
