import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Doc } from "./Doc";
import { Story } from "./Doc.story";

afterEach(cleanup);

test("outside a session there is no bar and no checks", () => {
  render(createElement(Doc, { title: "Note", meta: "today" }, "Body"));
  expect(screen.getByRole("heading", { name: "Note" })).toBeTruthy();
  expect(screen.getByText("Body")).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Checks" })).toBeNull();
  expect(screen.queryByText("Leave")).toBeNull();
});

test("a session shows the bar and toggles checks", () => {
  const onToggle = vi.fn();
  const onLeave = vi.fn();
  render(
    createElement(Doc, {
      title: "Note",
      session: {
        label: "Studying",
        onLeave,
        onToggle,
        checks: [{ id: "a", text: "Say it", done: false }],
      },
    }),
  );
  fireEvent.click(screen.getByLabelText("Say it"));
  expect(onToggle).toHaveBeenCalledWith("a");
  fireEvent.click(screen.getByRole("button", { name: /Leave/ }));
  expect(onLeave).toHaveBeenCalled();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByText("Studying · Cardiac output")).toBeTruthy();
});
