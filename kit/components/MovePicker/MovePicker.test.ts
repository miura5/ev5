import { createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { MovePicker, moveItems, type MoveTarget } from "./MovePicker";
import { Story } from "./MovePicker.story";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

afterEach(async () => {
  cleanup();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
});

const TARGETS: MoveTarget[] = [
  { id: "econ", title: "Economics 101" },
  { id: "course", title: "Course 101" },
  { id: "chap", title: "Chapter notes", parentId: "course" },
];

test("collections are listed by name, children under their parent, the current one ticked", () => {
  const items = moveItems(TARGETS, "chap", "No collection");
  expect(items.map((i) => i.label)).toEqual([
    "No collection",
    "Economics 101",
    "Course 101",
    "Chapter notes",
  ]);
  expect(items.find((i) => i.checked)?.label).toBe("Chapter notes");
  expect(items.find((i) => i.label === "Chapter notes")?.indent).toBe(1);
  expect(moveItems(TARGETS, null, "No collection")[0]?.checked).toBe(true);
});

test("an orphan whose parent is missing is listed at the top level", () => {
  const items = moveItems([{ id: "a", title: "A", parentId: "gone" }], null);
  expect(items).toEqual([{ key: "a", label: "A", checked: false, indent: 0 }]);
});

test("picking a collection moves; picking the current one does nothing", async () => {
  const onMove = vi.fn();
  render(
    createElement(MovePicker, {
      targets: TARGETS,
      current: "course",
      onMove,
      label: "Move to",
      trigger: createElement("button", null, "Move"),
    }),
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Move" }), {
    key: "Enter",
  });
  const cur = await screen.findByRole("menuitemradio", { name: /Course 101/ });
  expect(cur.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(cur);
  expect(onMove).not.toHaveBeenCalled();
});

test("picking another collection reports its id, and None reports null", async () => {
  const onMove = vi.fn();
  render(
    createElement(MovePicker, {
      targets: TARGETS,
      current: "course",
      onMove,
      label: "Move to",
      noneLabel: "No collection",
      trigger: createElement("button", null, "Move"),
    }),
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Move" }), {
    key: "Enter",
  });
  fireEvent.click(
    await screen.findByRole("menuitemradio", { name: /Economics 101/ }),
  );
  expect(onMove).toHaveBeenCalledWith("econ");
  fireEvent.keyDown(screen.getByRole("button", { name: "Move" }), {
    key: "Enter",
  });
  fireEvent.click(
    await screen.findByRole("menuitemradio", { name: /No collection/ }),
  );
  expect(onMove).toHaveBeenLastCalledWith(null);
});

test("the story renders", () => {
  render(createElement(Story));
  expect(screen.getByText("In: Chapter notes")).toBeTruthy();
});
