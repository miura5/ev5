import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Shell } from "./Shell.tsx";
import type { AreaEntry } from "./areas.ts";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const view: AreaEntry["view"] = ({ onToast }) => (
  <>
    <button onClick={() => onToast?.("Saved")}>say saved</button>
    <button onClick={() => onToast?.("Deleted", () => onToast("Restored"))}>
      delete
    </button>
  </>
);
const areas = [{ id: "today", route: "/", nav: "Today", view }];
const shell = () =>
  render(<Shell path="/" onNavigate={vi.fn()} areas={areas} />);

test("a view feeds the shell's one toast host, which stacks them in one place", () => {
  shell();
  expect(document.querySelectorAll("[data-ui='toast-host']").length).toBe(0);
  fireEvent.click(screen.getByText("say saved"));
  fireEvent.click(screen.getByText("delete"));
  expect(document.querySelectorAll("[data-ui='toast-host']").length).toBe(1);
  expect(document.querySelectorAll("[data-ui='toast']").length).toBe(2);
});

test("Undo runs the view's action and closes that toast; each toast closes itself", () => {
  vi.useFakeTimers();
  shell();
  fireEvent.click(screen.getByText("delete"));
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.queryByText("Deleted")).toBeNull();
  expect(screen.getByText("Restored")).toBeTruthy();
  act(() => void vi.advanceTimersByTime(5000));
  expect(document.querySelector("[data-ui='toast-host']")).toBeNull();
});

test("a toast never shows over the palette, and is back when it closes", () => {
  shell();
  fireEvent.click(screen.getByText("say saved"));
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  expect(document.querySelector("[data-ui='palette']")).not.toBeNull();
  expect(screen.queryByText("Saved")).toBeNull();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  expect(screen.getByText("Saved")).toBeTruthy();
});
