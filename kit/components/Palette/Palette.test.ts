import { createElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Palette } from "./Palette";
import { Story } from "./Palette.story";

beforeAll(() => {
  // jsdom lacks what cmdk and Radix read.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

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
  const opener = document.createElement("button");
  document.body.append(opener);
  opener.focus();
  const view = render(
    createElement(Palette, { groups, onRun, onAsk, onClose }),
  );
  return {
    onRun,
    onAsk,
    onClose,
    opener,
    view,
    input: screen.getByRole("combobox"),
  };
}

test("focus lands in the input", () => {
  const { input } = setup();
  expect(document.activeElement).toBe(input);
});

test("arrows move across groups and Enter runs", () => {
  const { onRun, input } = setup();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onRun).toHaveBeenCalledWith("c");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onRun).toHaveBeenLastCalledWith("a");
});

test("typing filters and adds the Ask E.V. row; Enter on it and Tab hand the text to E.V.", () => {
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

test("Esc closes and focus returns to where it was", async () => {
  const { onClose, opener, view } = setup();
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
  view.unmount();
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

test("focus is trapped while open", () => {
  const { input, opener } = setup();
  opener.focus();
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
    true,
  );
  expect(document.activeElement).not.toBe(opener);
  expect(input).toBeTruthy();
});

test("a click runs a row", () => {
  const { onRun } = setup();
  fireEvent.click(screen.getByText("Start next"));
  expect(onRun).toHaveBeenCalledWith("b");
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getAllByRole("combobox").length).toBe(1);
});

test("as a picker (ask off): no Ask row, no Tab, nested rows and the current one marked", () => {
  const onAsk = vi.fn();
  render(
    createElement(Palette, {
      groups: [
        {
          name: "Move to",
          items: [
            { key: "p", label: "Course 101", current: true },
            { key: "c", label: "Cells", indent: 1 },
          ],
        },
      ],
      onRun: vi.fn(),
      onAsk,
      onClose: vi.fn(),
      ask: false,
      label: "Move to",
    }),
  );
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "cel" } });
  expect(screen.getAllByRole("option").length).toBe(1);
  fireEvent.keyDown(input, { key: "Tab" });
  expect(onAsk).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "" } });
  expect(screen.getAllByRole("option")[0]!.textContent).toContain("✓");
});
