import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { NotesScreen } from "./Notes.screen.tsx";

test("the note page has no browser Title box or Save button", () => {
  render(<NotesScreen />);
  expect(screen.queryByLabelText("Title")).toBeNull();
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
});

import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { NotePageView } from "./NotePage.view.tsx";

const page = {
  id: "n1",
  title: "Untitled",
  collectionName: null,
  edited: "today",
  saveState: "saved" as const,
  body: [],
};

test("the note title takes typing: Enter saves, Esc cancels, empty is ignored", () => {
  const onRename = vi.fn();
  render(<NotePageView note={page} onRename={onRename} />);
  const t = screen.getByRole("textbox", { name: "Title" });
  t.textContent = "Cardiac cycle";
  fireEvent.keyDown(t, { key: "Enter" });
  fireEvent.blur(t);
  expect(onRename).toHaveBeenCalledWith("Cardiac cycle");
  onRename.mockClear();
  t.textContent = "Nope";
  fireEvent.keyDown(t, { key: "Escape" });
  expect(t.textContent).toBe("Untitled");
  fireEvent.blur(t);
  expect(onRename).not.toHaveBeenCalled();
  t.textContent = "  ";
  fireEvent.blur(t);
  expect(onRename).not.toHaveBeenCalled();
  expect(t.textContent).toBe("Untitled");
});
