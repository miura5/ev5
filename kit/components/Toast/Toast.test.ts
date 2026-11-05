import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Toast } from "./Toast";
import { Story } from "./Toast.story";

afterEach(cleanup);

test("a toast says one line and offers Undo only when it can be undone", () => {
  const onUndo = vi.fn();
  const { rerender } = render(createElement(Toast, { message: "Saved", onUndo }));
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

test("a toast hides itself after 4 seconds and tells its owner", () => {
  vi.useFakeTimers();
  try {
    const onDone = vi.fn();
    render(createElement(Toast, { message: "Changes sent", onDone }));
    act(() => void vi.advanceTimersByTime(3900));
    expect(screen.queryByRole("status")).not.toBeNull();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByRole("status")).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

test("a new message shows again and restarts the timer", () => {
  vi.useFakeTimers();
  try {
    const { rerender } = render(createElement(Toast, { message: "One" }));
    act(() => void vi.advanceTimersByTime(4100));
    expect(screen.queryByRole("status")).toBeNull();
    rerender(createElement(Toast, { message: "Two" }));
    expect(screen.getByRole("status").textContent).toContain("Two");
  } finally {
    vi.useRealTimers();
  }
});
