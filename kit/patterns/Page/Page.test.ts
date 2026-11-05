import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Empty } from "../Empty/Empty";
import { Section } from "../Section/Section";
import { Page } from "./Page";
import { Story } from "./Page.story";

afterEach(cleanup);

test("a page has a title, one meta, and optional crumb and actions", () => {
  render(
    createElement(Page, {
      title: "Today",
      meta: "Monday",
      crumb: "Back",
      actions: "Go",
    }),
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Today");
  expect(screen.getByText("Monday")).toBeTruthy();
  expect(screen.getByText("Back")).toBeTruthy();
  expect(screen.getByText("Go")).toBeTruthy();
  cleanup();
  render(createElement(Page, { title: "Plain" }));
  expect(document.querySelector(".kit-crumb")).toBeNull();
  expect(document.querySelector(".kit-head-actions")).toBeNull();
});

test("a section shows its label and an add action only when given one", () => {
  const onAdd = vi.fn();
  render(
    createElement(Section, { label: "Plan", addLabel: "Add item", onAdd }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  expect(onAdd).toHaveBeenCalledTimes(1);
  cleanup();
  render(createElement(Section, { label: "Plan" }));
  expect(screen.queryByRole("button")).toBeNull();
});

test("an empty state is one line plus one action", () => {
  const onAction = vi.fn();
  render(
    createElement(Empty, { line: "Nothing yet.", action: "Start", onAction }),
  );
  expect(screen.getByText("Nothing yet.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(onAction).toHaveBeenCalledTimes(1);
  cleanup();
  render(createElement(Empty, { line: "Just a line." }));
  expect(screen.queryByRole("button")).toBeNull();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByText("Library")).toBeTruthy();
  expect(screen.getAllByText("No sets yet.").length).toBe(1);
});

test("a page shows a leading glyph before the title", () => {
  render(
    createElement(Page, {
      title: "Pharmacology",
      glyph: createElement("svg", { "data-testid": "g" }),
    }),
  );
  expect(screen.getByTestId("g")).toBeTruthy();
});

test("an editable title renames on blur and on Enter, and Escape reverts", () => {
  const onTitle = vi.fn();
  render(createElement(Page, { title: "Old", onTitle }));
  const box = screen.getByRole("textbox", {
    name: "Title",
  }) as HTMLInputElement;
  expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  fireEvent.change(box, { target: { value: "Blurred" } });
  fireEvent.blur(box);
  expect(onTitle).toHaveBeenLastCalledWith("Blurred");
  fireEvent.change(box, { target: { value: "Entered" } });
  fireEvent.keyDown(box, { key: "Enter" });
  expect(onTitle).toHaveBeenLastCalledWith("Entered");
  expect(onTitle).toHaveBeenCalledTimes(2);
  fireEvent.change(box, { target: { value: "Discarded" } });
  fireEvent.keyDown(box, { key: "Escape" });
  expect(box.value).toBe("Old");
  expect(onTitle).toHaveBeenCalledTimes(2);
});

test("an unchanged or emptied title is not a rename", () => {
  const onTitle = vi.fn();
  render(createElement(Page, { title: "Same", onTitle }));
  const box = screen.getByRole("textbox", {
    name: "Title",
  }) as HTMLInputElement;
  fireEvent.blur(box);
  fireEvent.change(box, { target: { value: "  " } });
  fireEvent.blur(box);
  expect(onTitle).not.toHaveBeenCalled();
  expect(box.value).toBe("Same");
});

test("an empty editable title shows its placeholder and a new one takes focus with the text selected", () => {
  render(
    createElement(Page, {
      title: "",
      onTitle: () => undefined,
      titlePlaceholder: "Untitled note",
      focusTitle: true,
    }),
  );
  const box = screen.getByRole("textbox", {
    name: "Title",
  }) as HTMLInputElement;
  expect(box.placeholder).toBe("Untitled note");
  expect(document.activeElement).toBe(box);
  cleanup();
  render(
    createElement(Page, {
      title: "New note",
      onTitle: () => undefined,
      focusTitle: true,
    }),
  );
  const filled = screen.getByRole("textbox", {
    name: "Title",
  }) as HTMLInputElement;
  expect(document.activeElement).toBe(filled);
  expect([filled.selectionStart, filled.selectionEnd]).toEqual([0, 8]);
});

test("a page without onTitle has no textbox", () => {
  render(createElement(Page, { title: "Fixed" }));
  expect(screen.queryByRole("textbox")).toBeNull();
});
