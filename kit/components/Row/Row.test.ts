import { createElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EditorRow, Row } from "./Row";
import { Story } from "./Row.story";

afterEach(cleanup);

test("a row shows title, meta and value, and opens by click or Enter", () => {
  const onOpen = vi.fn();
  render(
    createElement(Row, {
      title: "Photosynthesis",
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

test("a folding row exposes aria-expanded and folds with the arrow keys", () => {
  const onToggle = vi.fn();
  const { rerender } = render(
    createElement(Row, {
      title: "Cell biology",
      fold: { open: false, onToggle },
    }),
  );
  const row = screen.getByRole("button", { name: "Cell biology" });
  expect(row.getAttribute("aria-expanded")).toBe("false");
  fireEvent.keyDown(row, { key: "ArrowLeft" });
  expect(onToggle).not.toHaveBeenCalled();
  fireEvent.keyDown(row, { key: "ArrowRight" });
  expect(onToggle).toHaveBeenCalledTimes(1);
  rerender(
    createElement(Row, {
      title: "Cell biology",
      fold: { open: true, onToggle },
    }),
  );
  const open = screen.getByRole("button", { name: "Cell biology" });
  expect(open.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(open, { key: "ArrowRight" });
  expect(onToggle).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(open, { key: "ArrowLeft" });
  expect(onToggle).toHaveBeenCalledTimes(2);
});

test("a nested row is indented one level", () => {
  render(
    createElement(Row, { title: "Child", level: 1, onOpen: () => undefined }),
  );
  expect(
    screen
      .getByRole("button", { name: "Child" })
      .classList.contains("kit-row-lv1"),
  ).toBe(true);
});

test("a status dot is named and a done row is marked", () => {
  render(
    createElement(Row, {
      title: "Quiz",
      status: { tone: "warn", label: "Due soon" },
      done: true,
    }),
  );
  expect(screen.getByRole("img", { name: "Due soon" })).toBeTruthy();
  expect(document.querySelector(".kit-row-done")).toBeTruthy();
});

test("actions sit in the row's hover slot and stay reachable by role", () => {
  const onMore = vi.fn();
  render(
    createElement(Row, {
      title: "Photosynthesis",
      actions: createElement("button", { onClick: onMore }, "More"),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  expect(onMore).toHaveBeenCalledTimes(1);
  expect(document.querySelector(".kit-row-act")).toBeTruthy();
});

test("right-click and the period key open the item menu", async () => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  const menu = {
    items: [{ key: "pin", label: "Pin", hint: "P" }],
    onPick: vi.fn(),
    label: "Row actions",
  };
  render(
    createElement(Row, { title: "Photosynthesis", onOpen: () => undefined, menu }),
  );
  const row = screen.getByRole("button", { name: "Photosynthesis" });
  fireEvent.contextMenu(row);
  expect(await screen.findByRole("menu", { name: "Row actions" })).toBeTruthy();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  fireEvent.keyDown(row, { key: "." });
  expect(await screen.findByRole("menu", { name: "Row actions" })).toBeTruthy();
});

test("an editor row has two named cells that edit in place", () => {
  const onTerm = vi.fn();
  render(
    createElement(EditorRow, {
      cells: [
        { label: "Term", value: "Photosynthesis", onChange: onTerm },
        { label: "Meaning", value: "Price", onChange: vi.fn() },
      ],
    }),
  );
  expect(screen.getAllByRole("textbox")).toHaveLength(2);
  fireEvent.change(screen.getByRole("textbox", { name: "Term" }), {
    target: { value: "Warfarin" },
  });
  expect(onTerm).toHaveBeenCalledWith("Warfarin");
});

test("an editor row can have one cell", () => {
  const onStep = vi.fn();
  render(
    createElement(EditorRow, {
      cells: [{ label: "Step", value: "Wash hands", onChange: onStep }],
    }),
  );
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(document.querySelector(".kit-erow-one")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Step" }), {
    target: { value: "Glove up" },
  });
  expect(onStep).toHaveBeenCalledWith("Glove up");
});

test("a row's bar slot is always drawn, apart from the hover actions", () => {
  render(
    createElement(Row, {
      title: "Weak spot",
      bar: createElement("i", { "data-testid": "bar" }),
      actions: "x",
    }),
  );
  const bar = screen.getByTestId("bar");
  expect(bar.closest(".kit-row-bar")).toBeTruthy();
  expect(bar.closest(".kit-row-act")).toBeNull();
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByText("Market structure")).toBeTruthy();
});

test("level 2 nests a row two steps in", () => {
  render(
    createElement(Row, { title: "Deep", level: 2, onOpen: () => undefined }),
  );
  const row = screen.getByRole("button", { name: "Deep" });
  expect(row.classList.contains("kit-row-lv2")).toBe(true);
  expect(row.classList.contains("kit-row-lv1")).toBe(false);
});

test("actionsShown keeps the actions visible and reachable", () => {
  const onGot = vi.fn();
  render(
    createElement(Row, {
      title: "Spend alert",
      actionsShown: true,
      actions: createElement("button", { onClick: onGot }, "Got it"),
    }),
  );
  expect(document.querySelector(".kit-row-acts-on")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Got it" }));
  expect(onGot).toHaveBeenCalledTimes(1);
  cleanup();
  render(createElement(Row, { title: "Plain", actions: "x" }));
  expect(document.querySelector(".kit-row-acts-on")).toBeNull();
});

test("a menu button opens the item menu without opening the row", async () => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  const onOpen = vi.fn();
  const onPick = vi.fn();
  render(
    createElement(Row, {
      title: "Vocabulary list",
      onOpen,
      menu: {
        items: [{ key: "pin", label: "Pin" }],
        onPick,
        label: "Actions for Vocabulary list",
        button: true,
      },
    }),
  );
  const dots = screen.getByRole("button", { name: "Actions for Vocabulary list" });
  fireEvent.click(dots);
  expect(onOpen).not.toHaveBeenCalled();
  fireEvent.keyDown(dots, { key: "Enter" });
  const item = await screen.findByRole("menuitem", { name: "Pin" });
  fireEvent.click(item);
  expect(onPick).toHaveBeenCalledWith("pin");
});
