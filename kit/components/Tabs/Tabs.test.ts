import { createElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Tabs } from "./Tabs";
import { Story } from "./Tabs.story";

afterEach(cleanup);

const TABS = [
  { id: "a", label: "Practice", count: 3 },
  { id: "b", label: "Sets" },
  { id: "c", label: "Dates", count: 0 },
] as const;

test("the lit tab is marked, counts show, and a tap reports the id", () => {
  const onChange = vi.fn();
  render(
    createElement(Tabs, { label: "Library", tabs: TABS, value: "a", onChange }),
  );
  expect(screen.getByRole("radiogroup", { name: "Library" })).toBeTruthy();
  expect(
    screen
      .getByRole("radio", { name: "Practice3" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.getByRole("radio", { name: "Dates0" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Sets" }).textContent).toBe("Sets");
  fireEvent.click(screen.getByRole("radio", { name: "Sets" }));
  expect(onChange).toHaveBeenCalledWith("b");
});

test("tapping the lit tab keeps it on and reports nothing", () => {
  const onChange = vi.fn();
  render(
    createElement(Tabs, { label: "Library", tabs: TABS, value: "b", onChange }),
  );
  fireEvent.click(screen.getByRole("radio", { name: "Sets" }));
  expect(onChange).not.toHaveBeenCalled();
});

test("one Tab stop and arrows move focus", async () => {
  render(
    createElement(Tabs, {
      label: "Library",
      tabs: TABS,
      value: "a",
      onChange: vi.fn(),
    }),
  );
  const lit = screen.getByRole("radio", { name: "Practice3" });
  lit.focus();
  fireEvent.keyDown(lit, { key: "ArrowRight" });
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Sets" }),
    ),
  );
  expect(
    screen.getAllByRole("radio").filter((r) => r.tabIndex === 0),
  ).toHaveLength(1);
});

test("the story switches tabs", () => {
  render(createElement(Story));
  fireEvent.click(screen.getByRole("radio", { name: "Sets12" }));
  expect(
    screen.getByRole("radio", { name: "Sets12" }).getAttribute("aria-checked"),
  ).toBe("true");
});
