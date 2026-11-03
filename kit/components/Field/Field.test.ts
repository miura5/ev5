import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Field, Segmented } from "./Field";
import { Story } from "./Field.story";

afterEach(cleanup);

test("a field is found by its label", () => {
  render(createElement(Field, { label: "Title", defaultValue: "Heparin" }));
  expect((screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe("Heparin");
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
  expect(screen.getByRole("button", { name: "3" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "5" }));
  expect(onChange).toHaveBeenCalledWith("5");
});

test("the story moves the choice", () => {
  render(createElement(Story));
  fireEvent.click(screen.getByRole("button", { name: "8" }));
  expect(screen.getByRole("button", { name: "8" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "5" }).getAttribute("aria-pressed")).toBe("false");
});
