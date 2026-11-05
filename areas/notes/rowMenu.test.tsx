import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NotePageView } from "./NotePage.view.tsx";
import { NotesView, type NoteSummary } from "./Notes.view.tsx";

afterEach(cleanup);

const collections = [
  { id: "c1", title: "NUR 112", parentId: null },
  { id: "c2", title: "BIO 201", parentId: null },
];
const note = (id: string, title: string, c: string | null): NoteSummary => ({
  id,
  title,
  preview: "",
  when: "today",
  collectionId: c,
});

function setup() {
  const onRowAction = vi.fn();
  const onMove = vi.fn();
  render(
    <NotesView
      notes={[note("a", "Med math", "c1")]}
      collections={collections}
      initialOpen={["c1"]}
      onRowAction={onRowAction}
      onMove={onMove}
    />,
  );
  return { onRowAction, onMove };
}

test("right-click on a Recent row opens Open, Pin, Move, Delete", async () => {
  setup();
  const rows = screen.getAllByText("Med math");
  fireEvent.contextMenu(rows[0]!);
  const menu = await screen.findByRole("menu");
  for (const l of ["Open", "Pin", "Move…", "Delete"])
    expect(menu.textContent).toContain(l);
});

test("the . key on a focused row opens its menu", async () => {
  setup();
  const row = screen.getAllByRole("button", { name: /Med math/ })[0]!;
  fireEvent.keyDown(row, { key: "." });
  expect(await screen.findByRole("menu")).toBeTruthy();
});

test("Move picks a collection and calls onMove with it", async () => {
  const { onMove } = setup();
  fireEvent.contextMenu(screen.getAllByText("Med math")[0]!);
  fireEvent.click(await screen.findByRole("menuitem", { name: /Move/ }));
  fireEvent.click(await screen.findByRole("button", { name: "BIO 201" }));
  expect(onMove).toHaveBeenCalledWith("a", "c2");
});

test("a note in the By-collection tree has the menu too", async () => {
  const { onRowAction } = setup();
  const dots = screen.getAllByRole("button", { name: "Actions for Med math" });
  expect(dots.length).toBe(2);
  fireEvent.keyDown(dots[1]!, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));
  expect(onRowAction).toHaveBeenCalledWith("a", "delete");
});

test("the note page menu has Pin, Move and Delete", async () => {
  const onPin = vi.fn();
  const onMove = vi.fn();
  render(
    <NotePageView
      note={{
        id: "a",
        title: "Med math",
        collectionName: "NUR 112",
        edited: "today",
        saveState: "saved",
        body: [],
      }}
      collections={collections}
      collectionId="c1"
      onPin={onPin}
      onMove={onMove}
      onDelete={() => undefined}
    />,
  );
  fireEvent.contextMenu(screen.getByText(/edited today/));
  fireEvent.click(await screen.findByRole("menuitem", { name: /Pin/ }));
  expect(onPin).toHaveBeenCalled();
  fireEvent.contextMenu(screen.getByText(/edited today/));
  fireEvent.click(await screen.findByRole("menuitem", { name: /Move/ }));
  fireEvent.click(await screen.findByRole("button", { name: "BIO 201" }));
  expect(onMove).toHaveBeenCalledWith("c2");
});
