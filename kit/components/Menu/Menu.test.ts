import { createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Menu, type MenuItem } from "./Menu";
import { Story } from "./Menu.story";

beforeAll(() => {
  // jsdom lacks what Radix's popper and pointer handling read.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

afterEach(cleanup);

const items: MenuItem[] = [
  { key: "a", label: "First" },
  { key: "b", label: "Second" },
  { key: "c", label: "Third" },
];

function open(props: Partial<Parameters<typeof Menu>[0]> = {}) {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(
    createElement(Menu, {
      items,
      onPick,
      onClose,
      label: "M",
      trigger: createElement("button", null, "Open"),
      ...props,
    }),
  );
  const trigger = screen.getByRole("button", { name: "Open" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  return { onPick, onClose, trigger };
}

/** Radix moves focus on a timer, so a key press settles before the next line reads focus. */
const key = (k: string) =>
  act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: k });
    await new Promise((r) => setTimeout(r, 5));
  });

test("closed until the trigger opens it; focus moves into the menu", async () => {
  render(
    createElement(Menu, {
      items,
      onPick: vi.fn(),
      label: "M",
      trigger: createElement("button", null, "Open"),
    }),
  );
  expect(screen.queryByRole("menu")).toBeNull();
  const trigger = screen.getByRole("button", { name: "Open" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  const menu = await screen.findByRole("menu");
  expect(menu.contains(document.activeElement)).toBe(true);
});

test("arrows move focus (wrapping), Enter picks and closes", async () => {
  const { onPick, onClose } = open();
  await screen.findByRole("menu");
  await key("ArrowDown");
  expect(document.activeElement?.textContent).toContain("Second");
  await key("ArrowUp");
  await key("ArrowUp");
  expect(document.activeElement?.textContent).toContain("Third");
  await key("Enter");
  expect(onPick).toHaveBeenCalledWith("c");
  expect(onClose).toHaveBeenCalled();
  expect(screen.queryByRole("menu")).toBeNull();
});

test("Esc closes and returns focus to the trigger", async () => {
  const { onPick, onClose, trigger } = open();
  await screen.findByRole("menu");
  await key("Escape");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(onClose).toHaveBeenCalled();
  expect(onPick).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(trigger);
});

test("typeahead jumps to the item that starts with what is typed", async () => {
  open();
  await screen.findByRole("menu");
  await key("T");
  expect(document.activeElement?.textContent).toContain("Third");
  await key("h");
  expect(document.activeElement?.textContent).toContain("Third");
});

test("a picker marks its current choice with radio items", async () => {
  const { onPick } = open({
    items: [
      { key: "due", label: "Due", checked: false },
      { key: "name", label: "Name", checked: true },
    ],
  });
  await screen.findByRole("menu");
  const radios = screen.getAllByRole("menuitemradio");
  expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
    "false",
    "true",
  ]);
  fireEvent.click(radios[0] as HTMLElement);
  expect(onPick).toHaveBeenCalledWith("due");
});

test("right-click opens the context variant at the region", async () => {
  const onPick = vi.fn();
  render(
    createElement(Menu, {
      items,
      onPick,
      label: "Row",
      on: "contextmenu",
      trigger: createElement("p", null, "Region"),
    }),
  );
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.contextMenu(screen.getByText("Region"));
  const menu = await screen.findByRole("menu");
  expect(menu.contains(document.activeElement)).toBe(true);
  await key("ArrowDown");
  await key("Enter");
  expect(onPick).toHaveBeenCalledWith("a");
});

test("the story renders its triggers", () => {
  render(createElement(Story));
  expect(screen.getAllByRole("button").length).toBe(2);
  expect(screen.queryByRole("menu")).toBeNull();
});
