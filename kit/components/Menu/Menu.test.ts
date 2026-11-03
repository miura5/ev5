import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Menu } from "./Menu";
import { Story } from "./Menu.story";

afterEach(cleanup);

const items = [
  { key: "a", label: "First" },
  { key: "b", label: "Second", checked: true },
];

test("arrows move, Enter picks, Esc closes", () => {
  const [onPick, onClose] = [vi.fn(), vi.fn()];
  render(createElement(Menu, { items, onPick, onClose, label: "M" }));
  const menu = screen.getByRole("menu");
  expect(document.activeElement).toBe(menu);
  fireEvent.keyDown(menu, { key: "ArrowDown" });
  fireEvent.keyDown(menu, { key: "Enter" });
  expect(onPick).toHaveBeenCalledWith("b");
  fireEvent.keyDown(menu, { key: "ArrowDown" });
  fireEvent.keyDown(menu, { key: "Enter" });
  expect(onPick).toHaveBeenLastCalledWith("a");
  fireEvent.keyDown(menu, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});

test("a click picks and a picker marks its current choice", () => {
  const onPick = vi.fn();
  render(createElement(Menu, { items, onPick, onClose: vi.fn(), label: "M" }));
  expect(screen.getByRole("menuitemradio").getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByText("First"));
  expect(onPick).toHaveBeenCalledWith("a");
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getAllByRole("menu").length).toBe(2);
});
