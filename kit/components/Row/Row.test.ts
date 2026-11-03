import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Row } from "./Row";
import { Story } from "./Row.story";

afterEach(cleanup);

test("a row shows title, meta and value, and opens by click or Enter", () => {
  const onOpen = vi.fn();
  render(
    createElement(Row, {
      title: "Heparin",
      meta: "12 cards",
      value: "3 due",
      onOpen,
    }),
  );
  expect(screen.getByText("12 cards")).toBeTruthy();
  expect(screen.getByText("3 due")).toBeTruthy();
  const row = screen.getByRole("button");
  fireEvent.click(row);
  fireEvent.keyDown(row, { key: "Enter" });
  expect(onOpen).toHaveBeenCalledTimes(2);
});

test("a row with no action is not a button", () => {
  render(createElement(Row, { title: "Plain" }));
  expect(screen.queryByRole("button")).toBeNull();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByText("Fluid balance")).toBeTruthy();
});
