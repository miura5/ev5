import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Palette } from "./Palette";
import { Story } from "./Palette.story";

afterEach(cleanup);

const groups = [
  {
    name: "Commands",
    items: [
      { key: "a", label: "New note" },
      { key: "b", label: "Start next", hint: "S" },
    ],
  },
  { name: "Go to", items: [{ key: "c", label: "Library" }] },
];

function setup() {
  const [onRun, onAsk, onClose] = [vi.fn(), vi.fn(), vi.fn()];
  render(createElement(Palette, { groups, onRun, onAsk, onClose }));
  return { onRun, onAsk, onClose, input: screen.getByRole("combobox") };
}

test("opens focused; arrows move across groups, Enter runs, Esc closes", () => {
  const { onRun, onClose, input } = setup();
  expect(document.activeElement).toBe(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onRun).toHaveBeenCalledWith("c");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onRun).toHaveBeenLastCalledWith("a");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});

test("typing filters and adds the Ask E.V. row; Tab hands the text to E.V.", () => {
  const { onRun, onAsk, input } = setup();
  fireEvent.change(input, { target: { value: "lib" } });
  expect(screen.getAllByRole("option").length).toBe(2);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onAsk).toHaveBeenCalledWith("lib");
  expect(onRun).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Tab" });
  expect(onAsk).toHaveBeenCalledTimes(2);
});

test("a click runs a row and a click on the scrim closes", () => {
  const { onRun, onClose } = setup();
  fireEvent.click(screen.getByText("Start next"));
  expect(onRun).toHaveBeenCalledWith("b");
  fireEvent.mouseDown(document.querySelector("[data-ui='palette']")!);
  expect(onClose).toHaveBeenCalled();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getAllByRole("combobox").length).toBe(1);
});
