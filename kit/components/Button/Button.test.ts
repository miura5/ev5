import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Button } from "./Button";
import { Story } from "./Button.story";

afterEach(cleanup);

test("a button defaults to secondary and never submits a form", () => {
  render(createElement(Button, null, "End"));
  const b = screen.getByRole("button", { name: "End" });
  expect(b.getAttribute("data-kind")).toBe("secondary");
  expect(b.getAttribute("type")).toBe("button");
});

test("the key hint sits beside the label", () => {
  render(createElement(Button, { kind: "primary", hint: "C" }, "New note"));
  expect(
    screen.getByRole("button", { name: /New note/ }).querySelector("kbd")
      ?.textContent,
  ).toBe("C");
});

test("a disabled button does not click", () => {
  const onClick = vi.fn();
  render(createElement(Button, { disabled: true, onClick }, "Turn over"));
  fireEvent.click(screen.getByRole("button", { name: "Turn over" }));
  expect(onClick).not.toHaveBeenCalled();
});

test("the story shows every kind", () => {
  const { container } = render(createElement(Story));
  const kinds = [...container.querySelectorAll("[data-kind]")].map((n) =>
    n.getAttribute("data-kind"),
  );
  expect(new Set(kinds)).toEqual(
    new Set(["primary", "secondary", "text", "icon"]),
  );
});
