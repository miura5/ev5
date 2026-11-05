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
  { id: "bio", title: "BIO 201" },
  { id: "nur", title: "NUR 112" },
  { id: "ph", title: "Pharmacology", parentId: "nur" },
];

test("collections are listed by name, children under their parent, the current one ticked", () => {
  const items = moveItems(TARGETS, "ph", "No collection");
  expect(items.map((i) => i.label)).toEqual([
    "No collection",
    "BIO 201",
    "NUR 112",
    "Pharmacology",
  ]);
  expect(items.find((i) => i.checked)?.label).toBe("Pharmacology");
  expect(items.find((i) => i.label === "Pharmacology")?.indent).toBe(1);
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
      current: "nur",
      onMove,
      label: "Move to",
      trigger: createElement("button", null, "Move"),
    }),
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Move" }), {
    key: "Enter",
  });
  const cur = await screen.findByRole("menuitemradio", { name: /NUR 112/ });
  expect(cur.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(cur);
  expect(onMove).not.toHaveBeenCalled();
});

test("picking another collection reports its id, and None reports null", async () => {
  const onMove = vi.fn();
  render(
    createElement(MovePicker, {
      targets: TARGETS,
      current: "nur",
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
    await screen.findByRole("menuitemradio", { name: /BIO 201/ }),
  );
  expect(onMove).toHaveBeenCalledWith("bio");
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
  expect(screen.getByText("In: Pharmacology")).toBeTruthy();
});
