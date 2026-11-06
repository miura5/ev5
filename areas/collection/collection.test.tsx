import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { collectionArea } from "./area.ts";
import { CollectionView, type CollectionEntry } from "./Collection.view.tsx";

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

const exam: CollectionEntry = {
  id: "d1",
  type: "date",
  title: "Exam 2",
  meta: "Nov 12",
};
const note: CollectionEntry = {
  id: "n1",
  type: "note",
  title: "Cardiac drugs",
};
const sub: CollectionEntry = { id: "c2", type: "collection", title: "Labs" };
const base = { title: "NUR 112", dates: [exam], nested: [sub], items: [note] };

test("dates come first, then nested collections and items", () => {
  const onOpen = vi.fn();
  render(<CollectionView {...base} pinned onOpen={onOpen} />);
  expect(
    screen.getByRole("region", { name: "Coming up" }).textContent,
  ).toContain("Exam 2");
  const all = screen.getByRole("region", { name: "Everything" }).textContent!;
  expect(all.indexOf("Labs")).toBeLessThan(all.indexOf("Cardiac drugs"));
  expect(screen.getByText("Collection · 3 items · pinned")).toBeTruthy();
  fireEvent.click(screen.getByText("Cardiac drugs"));
  expect(onOpen).toHaveBeenCalledWith("n1");
  expect(collectionArea.route).toBe("/collection");
});

test("pin, new and back report; empty collection explains itself", () => {
  const onTogglePin = vi.fn();
  const onBack = vi.fn();
  render(
    <CollectionView
      title="Labs"
      parent="NUR 112"
      dates={[]}
      nested={[]}
      items={[]}
      onTogglePin={onTogglePin}
      onBack={onBack}
    />,
  );
  fireEvent.click(screen.getByText("Pin"));
  fireEvent.click(screen.getByText("← NUR 112"));
  expect(onTogglePin).toHaveBeenCalled();
  expect(onBack).toHaveBeenCalled();
  expect(screen.getByText(/Nothing here yet/)).toBeTruthy();
});

test("/collection/:id opens that collection and Back goes to its parent", async () => {
  const body = (path: string) =>
    path.includes("pins")
      ? { pins: [] }
      : path.includes("memberships")
        ? {
            memberships: [
              { collection: "notes", id: "n1", collectionId: "b", at: 1 },
            ],
          }
        : {
            collections: [
              { id: "a", title: "NUR 112", parentId: null, pos: 0 },
              { id: "b", title: "Labs", parentId: "a", pos: 1 },
            ],
          };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      expect(url.startsWith("/api/v1/")).toBe(true);
      expect(url).not.toContain("/api/v1//api/v1");
      return Promise.resolve(
        new Response(JSON.stringify(body(url)), { status: 200 }),
      );
    }),
  );
  localStorage.setItem("ev5.token", "t");
  vi.resetModules();
  const { CollectionScreen } = await import("./Collection.screen.tsx");
  const onNavigate = vi.fn();
  render(<CollectionScreen path="/collection/b" onNavigate={onNavigate} />);
  expect(await screen.findByDisplayValue("Labs")).toBeTruthy();
  fireEvent.click(screen.getByText("← NUR 112"));
  expect(onNavigate).toHaveBeenCalledWith("/collection/a");
  localStorage.clear();
  vi.unstubAllGlobals();
});

test("pinned items are listed under Pinned, named from their docs", async () => {
  const body = (path: string) =>
    path.includes("pins")
      ? { pins: [{ collection: "notes", id: "n9", pos: 0, at: 3 }] }
      : path.startsWith("docs")
        ? { docs: [{ id: "n9", data: { title: "Insulin types" } }] }
        : path.includes("memberships")
          ? { memberships: [] }
          : {
              collections: [
                { id: "a", title: "NUR 112", parentId: null, pos: 0 },
              ],
            };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(JSON.stringify(body(url.replace("/api/v1/", ""))), {
          status: 200,
        }),
      ),
    ),
  );
  localStorage.setItem("ev5.token", "t");
  vi.resetModules();
  const { CollectionScreen } = await import("./Collection.screen.tsx");
  render(<CollectionScreen path="/collection" />);
  expect(await screen.findByText("Insulin types")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Pinned" }).textContent).toContain(
    "Insulin types",
  );
  localStorage.clear();
  vi.unstubAllGlobals();
});

test("the item menu opens, pins or unpins, and deletes through item.* names", async () => {
  const onItemAction = vi.fn();
  render(
    <CollectionView
      {...base}
      pinnedItems={[note]}
      onItemAction={onItemAction}
    />,
  );
  await openMenu("Actions for Cardiac drugs");
  fireEvent.click(screen.getByText("Unpin"));
  expect(onItemAction).toHaveBeenCalledWith("n1", "unpin");
  await openMenu("Actions for Labs");
  fireEvent.click(screen.getByText("Delete"));
  expect(onItemAction).toHaveBeenCalledWith("c2", "delete");
});

test("no menu without an action handler", () => {
  render(<CollectionView {...base} />);
  expect(screen.queryByLabelText("Actions for Labs")).toBeNull();
});

test("a note row opens the note, and the collection shows its name and notes", async () => {
  const body = (path: string) =>
    path.startsWith("docs")
      ? { docs: [{ id: "n1", data: {} }] }
      : path.includes("pins")
        ? { pins: [] }
        : path.includes("memberships")
          ? {
              memberships: [
                { collection: "notes", id: "n1", collectionId: "b", at: 1 },
              ],
            }
          : {
              collections: [{ id: "b", title: "Labs", parentId: null, pos: 0 }],
            };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        new Response(JSON.stringify(body(url.replace("/api/v1/", ""))), {
          status: 200,
        }),
      ),
    ),
  );
  localStorage.setItem("ev5.token", "t");
  vi.resetModules();
  const { CollectionScreen } = await import("./Collection.screen.tsx");
  const onNavigate = vi.fn();
  render(<CollectionScreen path="/collection/b" onNavigate={onNavigate} />);
  expect(await screen.findByDisplayValue("Labs")).toBeTruthy();
  expect(screen.getByText("Untitled")).toBeTruthy();
  expect(screen.getByText(/^Note · /)).toBeTruthy();
  expect(screen.queryByText("n1")).toBeNull();
  fireEvent.click(screen.getByText("Untitled"));
  expect(onNavigate).toHaveBeenLastCalledWith("/notes?open=n1");
  onNavigate.mockClear();
  await openMenu("Actions for Untitled");
  fireEvent.click(screen.getByText("Open"));
  expect(onNavigate).toHaveBeenCalledWith("/notes?open=n1");
  localStorage.clear();
  vi.unstubAllGlobals();
});

test("the collection page offers Delete for the collection itself", () => {
  const onDelete = vi.fn();
  render(
    <CollectionView
      title="BIO 201"
      dates={[]}
      nested={[]}
      items={[]}
      onDelete={onDelete}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});

test("the collection title saves on Enter and Esc puts the old words back", () => {
  const onRename = vi.fn();
  render(
    <CollectionView
      title="Untitled collection"
      dates={[]}
      nested={[]}
      items={[]}
      onRename={onRename}
    />,
  );
  const h = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
  fireEvent.change(h, { target: { value: "BIO 201" } });
  fireEvent.keyDown(h, { key: "Enter" });
  expect(onRename).toHaveBeenCalledWith("BIO 201");
  fireEvent.change(h, { target: { value: "x" } });
  fireEvent.keyDown(h, { key: "Escape" });
  expect(h.value).toBe("Untitled collection");
});
