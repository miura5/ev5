import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Detail } from "./Detail";
import { Story } from "./Detail.story";

afterEach(cleanup);

test("a property edits in place, a plain one does not", () => {
  const onChange = vi.fn();
  render(
    createElement(Detail, {
      title: "Set",
      properties: [
        { label: "Collection", value: "BIO", onChange },
        { label: "Cards", value: "8" },
      ],
    }),
  );
  fireEvent.change(screen.getByLabelText("Collection"), {
    target: { value: "NUR" },
  });
  expect(onChange).toHaveBeenCalledWith("NUR");
  expect(screen.queryByLabelText("Cards")).toBeNull();
  expect(screen.getByText("8")).toBeTruthy();
});

test("the main action and ⋯ call back; neither shows when absent", () => {
  const onRun = vi.fn();
  const onMore = vi.fn();
  const { rerender } = render(
    createElement(Detail, {
      title: "Set",
      properties: [],
      primary: { label: "Study", onRun },
      onMore,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Study" }));
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(onRun).toHaveBeenCalled();
  expect(onMore).toHaveBeenCalled();
  rerender(createElement(Detail, { title: "Set", properties: [] }));
  expect(screen.queryByRole("button")).toBeNull();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByText("Cardiac output terms")).toBeTruthy();
});
