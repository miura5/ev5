import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Toast } from "./Toast";
import { Story } from "./Toast.story";

afterEach(cleanup);

test("a toast says one line and offers Undo only when it can be undone", () => {
  const onUndo = vi.fn();
  const { rerender } = render(
    createElement(Toast, { message: "Saved", onUndo }),
  );
  expect(screen.getByRole("status").textContent).toContain("Saved");
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(onUndo).toHaveBeenCalledTimes(1);
  rerender(createElement(Toast, { message: "Saved" }));
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByRole("status")).toBeTruthy();
});
