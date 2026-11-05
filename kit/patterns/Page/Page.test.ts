import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Empty } from "../Empty/Empty";
import { Section } from "../Section/Section";
import { Page } from "./Page";
import { Story } from "./Page.story";

afterEach(cleanup);

test("a page has a title, one meta, and optional crumb and actions", () => {
  render(createElement(Page, { title: "Today", meta: "Monday", crumb: "Back", actions: "Go" }));
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
  render(createElement(Section, { label: "Plan", addLabel: "Add item", onAdd }));
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  expect(onAdd).toHaveBeenCalledTimes(1);
  cleanup();
  render(createElement(Section, { label: "Plan" }));
  expect(screen.queryByRole("button")).toBeNull();
});

test("an empty state is one line plus one action", () => {
  const onAction = vi.fn();
  render(createElement(Empty, { line: "Nothing yet.", action: "Start", onAction }));
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
