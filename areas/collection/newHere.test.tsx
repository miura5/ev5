import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { CollectionView, type CollectionEntry } from "./Collection.view.tsx";

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

const openMenu = async (name: string) => {
  const t = screen.getAllByLabelText(name)[0]!;
  t.focus();
  await act(async () => {
    fireEvent.keyDown(t, { key: "Enter" });
    await new Promise((r) => setTimeout(r, 5));
  });
};

const note: CollectionEntry = {
  id: "n1",
  type: "note",
  title: "Cardiac drugs",
};
const base = { title: "Biology 101", dates: [], nested: [], items: [note] };

test("New offers a note, a set, a date and a collection here, and reports the pick", async () => {
  const onNewHere = vi.fn();
  render(<CollectionView {...base} onNewHere={onNewHere} />);
  await openMenu("New in this collection");
  for (const l of ["Note", "Set", "Date", "Collection inside"])
    expect(screen.getByRole("menuitem", { name: l })).toBeTruthy();
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: "Set" }));
  });
  expect(onNewHere).toHaveBeenCalledWith("set");
});

test("inside a nested collection New does not offer another collection", async () => {
  render(<CollectionView {...base} parent="Biology 101" onNewHere={vi.fn()} />);
  await openMenu("New in this collection");
  expect(
    screen.queryByRole("menuitem", { name: "Collection inside" }),
  ).toBeNull();
});

test("New > Note sends collection.new_here and opens the new note", async () => {
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const ok = (b: unknown) =>
        Promise.resolve(new Response(JSON.stringify(b), { status: 200 }));
      if (init?.method === "POST") {
        sent.push(`${url} ${String(init.body)}`);
        return ok({ mode: "direct", result: { id: "n-new" } });
      }
      return ok(
        url.includes("collections")
          ? {
              collections: [
                { id: "a", title: "Biology 101", parentId: null, pos: 0 },
              ],
            }
          : url.includes("pins")
            ? { pins: [] }
            : { memberships: [] },
      );
    }),
  );
  localStorage.setItem("ev5.token", "t");
  vi.resetModules();
  const { CollectionScreen } = await import("./Collection.screen.tsx");
  const onNavigate = vi.fn();
  render(<CollectionScreen path="/collection/a" onNavigate={onNavigate} />);
  await screen.findByDisplayValue("Biology 101");
  await openMenu("New in this collection");
  await act(async () => {
    fireEvent.click(screen.getByRole("menuitem", { name: "Note" }));
  });
  await waitFor(() =>
    expect(onNavigate).toHaveBeenCalledWith("/notes?open=n-new"),
  );
  expect(sent[0]).toContain("commands/collection.new_here");
  expect(sent[0]).toContain('"kind":"note"');
  localStorage.clear();
  vi.unstubAllGlobals();
});
