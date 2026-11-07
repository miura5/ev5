import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PracticeCard } from "./PracticeCard";
import { Story } from "./PracticeCard.story";

afterEach(cleanup);

const base = {
  title: "Market structure",
  question: "Which sign?",
  position: 2,
  total: 8,
  options: ["A", "B"],
  source: "Note · Markets",
};

test("it commits the picked option and ends on End", () => {
  const onCommit = vi.fn();
  const onEnd = vi.fn();
  render(createElement(PracticeCard, { ...base, onCommit, onEnd }));
  expect(screen.getByText("2 of 8")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "B" }));
  fireEvent.click(screen.getByRole("button", { name: "Commit answer" }));
  expect(onCommit).toHaveBeenCalledWith("B");
  fireEvent.click(screen.getByRole("button", { name: "End" }));
  expect(onEnd).toHaveBeenCalled();
});

test("the hint shows only after Hint, and no button without one", () => {
  const { rerender } = render(
    createElement(PracticeCard, { ...base, hint: "Think veins" }),
  );
  expect(screen.queryByText("Think veins")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(screen.getByText("Think veins")).toBeTruthy();
  rerender(createElement(PracticeCard, base));
  expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByText("Market structure")).toBeTruthy();
});
