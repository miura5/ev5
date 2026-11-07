import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Detail } from "./Detail";
import { Story } from "./Detail.story";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

test("a property edits in place, a plain one does not", () => {
  const onChange = vi.fn();
  render(
    createElement(Detail, {
      title: "Set",
      properties: [
        { label: "Collection", value: "History", onChange },
        { label: "Cards", value: "8" },
      ],
    }),
  );
  fireEvent.change(screen.getByLabelText("Collection"), {
    target: { value: "Languages" },
  });
  expect(onChange).toHaveBeenCalledWith("Languages");
  expect(screen.queryByLabelText("Cards")).toBeNull();
  expect(screen.getByText("8")).toBeTruthy();
});

test("the main action calls back and ⋯ opens the passed-in menu; neither shows when absent", async () => {
  const onRun = vi.fn();
  const onPick = vi.fn();
  const { rerender } = render(
    createElement(Detail, {
      title: "Set",
      properties: [],
      primary: { label: "Study", onRun },
      more: { items: [{ key: "x", label: "Rename" }], onPick },
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Study" }));
  const more = screen.getByRole("button", { name: "More" });
  more.focus();
  fireEvent.keyDown(more, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
  expect(onRun).toHaveBeenCalled();
  expect(onPick).toHaveBeenCalledWith("x");
  rerender(createElement(Detail, { title: "Set", properties: [] }));
  expect(screen.queryByRole("button")).toBeNull();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByText("Supply and demand terms")).toBeTruthy();
});
