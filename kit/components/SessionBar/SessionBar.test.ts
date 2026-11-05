import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SessionBar } from "./SessionBar";
import { Story } from "./SessionBar.story";

afterEach(cleanup);

test("the bar shows the clock, the read-along note and the Space hint", () => {
  render(createElement(SessionBar, { timer: "18:20", readAlong: true, onTogglePause: vi.fn(), onEnd: vi.fn() }));
  expect(screen.getByText("18:20")).toBeTruthy();
  expect(screen.getByText("read-along on")).toBeTruthy();
  expect(screen.getByText("Space")).toBeTruthy();
});

test("Pause and End call back; paused reads Resume", () => {
  const onTogglePause = vi.fn();
  const onEnd = vi.fn();
  const { rerender } = render(createElement(SessionBar, { timer: "0:05", onTogglePause, onEnd }));
  expect(screen.queryByText("read-along on")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
  fireEvent.click(screen.getByRole("button", { name: "End" }));
  expect(onTogglePause).toHaveBeenCalledOnce();
  expect(onEnd).toHaveBeenCalledOnce();
  rerender(createElement(SessionBar, { timer: "0:05", paused: true, onTogglePause, onEnd }));
  expect(screen.getByRole("button", { name: /Resume/ })).toBeTruthy();
});

test("the story renders both states", () => {
  render(createElement(Story));
  expect(screen.getAllByText("18:20")).toHaveLength(2);
});
