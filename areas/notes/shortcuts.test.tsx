import { render, screen, fireEvent, act } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { NotePageView } from "./NotePage.view.tsx";
import { NotesScreen } from "./Notes.screen.tsx";
import { SHORTCUTS_EVENT } from "./parts/shortcuts.ts";
import { paletteEntries } from "../../commands/client.ts";

const note = {
  title: "T",
  edited: "now",
  saveState: "saved",
  body: [],
} as never;

test("the note page has a Shortcuts button that asks for the list", () => {
  const onShortcuts = vi.fn();
  render(<NotePageView note={note} onShortcuts={onShortcuts} />);
  fireEvent.click(screen.getByRole("button", { name: "Shortcuts" }));
  expect(onShortcuts).toHaveBeenCalled();
});

test("the palette's Note shortcuts event opens the list in Detail", () => {
  const onDetail = vi.fn();
  render(<NotesScreen onDetail={onDetail} />);
  act(() => {
    window.dispatchEvent(new Event(SHORTCUTS_EVENT));
  });
  const d = onDetail.mock.calls[0]?.[0];
  expect(d.title).toBe("Note shortcuts");
  expect(d.properties.map((p: { label: string }) => p.label)).toContain("Bold");
});

test("⌘K lists Note shortcuts in Notes only", () => {
  const e = paletteEntries.find((x) => x.name === "notes.shortcuts");
  expect(e?.title).toBe("Note shortcuts");
  expect(e?.places).toEqual(["notes"]);
});
