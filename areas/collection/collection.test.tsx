import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { collectionArea } from "./area.ts";
import { CollectionView, type CollectionEntry } from "./Collection.view.tsx";

afterEach(cleanup);

const exam: CollectionEntry = { id: "d1", type: "date", title: "Exam 2", meta: "Nov 12" };
const note: CollectionEntry = { id: "n1", type: "note", title: "Cardiac drugs" };
const sub: CollectionEntry = { id: "c2", type: "collection", title: "Labs" };
const base = { title: "NUR 112", dates: [exam], nested: [sub], items: [note] };

test("dates come first, then nested collections and items", () => {
  const onOpen = vi.fn();
  render(<CollectionView {...base} pinned onOpen={onOpen} />);
  expect(document.querySelector('[data-section="Coming up"]')!.textContent).toContain("Exam 2");
  const all = document.querySelector('[data-section="Everything"]')!.textContent!;
  expect(all.indexOf("Labs")).toBeLessThan(all.indexOf("Cardiac drugs"));
  expect(screen.getByText("Collection · 3 items · pinned")).toBeTruthy();
  fireEvent.click(screen.getByText("Cardiac drugs"));
  expect(onOpen).toHaveBeenCalledWith("n1");
  expect(collectionArea.route).toBe("/collection");
});

test("pin, new and back report; empty collection explains itself", () => {
  const onTogglePin = vi.fn();
  const onNew = vi.fn();
  const onBack = vi.fn();
  render(
    <CollectionView
      title="Labs"
      parent="NUR 112"
      dates={[]}
      nested={[]}
      items={[]}
      onTogglePin={onTogglePin}
      onNew={onNew}
      onBack={onBack}
    />,
  );
  fireEvent.click(screen.getByText("Pin"));
  fireEvent.click(screen.getByText("New"));
  fireEvent.click(screen.getByText("← NUR 112"));
  expect(onTogglePin).toHaveBeenCalled();
  expect(onNew).toHaveBeenCalled();
  expect(onBack).toHaveBeenCalled();
  expect(screen.getByText(/Nothing here yet/)).toBeTruthy();
});

test("/collection/:id opens that collection and Back goes to its parent", async () => {
  const body = (path: string) =>
    path.includes("memberships")
      ? { memberships: [{ collection: "notes", id: "n1", collectionId: "b", at: 1 }] }
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
      return Promise.resolve(new Response(JSON.stringify(body(url)), { status: 200 }));
    }),
  );
  localStorage.setItem("ev5.token", "t");
  vi.resetModules();
  const { CollectionScreen } = await import("./Collection.screen.tsx");
  const onNavigate = vi.fn();
  render(<CollectionScreen path="/collection/b" onNavigate={onNavigate} />);
  expect(await screen.findByText("Labs")).toBeTruthy();
  fireEvent.click(screen.getByText("← NUR 112"));
  expect(onNavigate).toHaveBeenCalledWith("/collection/a");
  localStorage.clear();
  vi.unstubAllGlobals();
});
