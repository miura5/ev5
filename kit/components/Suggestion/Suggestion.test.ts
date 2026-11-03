import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Suggestion } from "./Suggestion";
import { Story } from "./Suggestion.story";

afterEach(cleanup);

test("a proposal accepts, edits and dismisses", () => {
  const [a, e, d] = [vi.fn(), vi.fn(), vi.fn()];
  render(
    createElement(Suggestion, {
      text: "Do it",
      onAccept: a,
      onEdit: e,
      onDismiss: d,
    }),
  );
  fireEvent.click(screen.getByText("Accept"));
  fireEvent.click(screen.getByText("Edit"));
  fireEvent.click(screen.getByLabelText("Not now"));
  expect([a, e, d].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
});

test("a draft says Keep and Drop, and has no Edit unless given", () => {
  render(
    createElement(Suggestion, {
      kind: "draft",
      text: "Card",
      onAccept: vi.fn(),
      onDismiss: vi.fn(),
    }),
  );
  expect(screen.getByText("Keep")).toBeTruthy();
  expect(screen.getByLabelText("Drop")).toBeTruthy();
  expect(screen.queryByText("Edit")).toBeNull();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getAllByText("Accept").length).toBe(1);
});
