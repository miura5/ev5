import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { notesArea } from "./area.ts";
import { NotePageView } from "./NotePage.view.tsx";
import {
  NotesView,
  type NoteCollection,
  type NoteSummary,
} from "./Notes.view.tsx";
import type { NotePageData } from "./types.ts";

afterEach(cleanup);

const collections: NoteCollection[] = [
  { id: "course-a", title: "Course A", parentId: null },
  { id: "lecture", title: "Lecture notes", parentId: "course-a" },
];
const n = (
  id: string,
  title: string,
  collectionId: string | null,
): NoteSummary => ({
  id,
  title,
  preview: `${title} preview`,
  when: "today",
  collectionId,
});
const notes = [
  n("a", "Unit maths", "course-a"),
  n("c", "Loose idea", null),
  n("e", "Third", null),
  n("b", "Fluid balance", "lecture"),
  n("d", "Fourth", null),
];

test("home lists the 3 most recent and folds collections open to their notes", () => {
  const onOpenNote = vi.fn();
  render(
    <NotesView
      notes={notes}
      collections={collections}
      onOpenNote={onOpenNote}
    />,
  );
  expect(screen.queryByText("Fourth")).toBeNull();
  expect(screen.queryByText("Fluid balance")).toBeNull();
  const top = screen.getByRole("button", { name: /^Course A/ });
  expect(top.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(top);
  fireEvent.click(screen.getByRole("button", { name: /^Lecture notes/ }));
  fireEvent.click(screen.getByText("Fluid balance"));
  expect(onOpenNote).toHaveBeenCalledWith("b");
});

test("new note carries the collection; the loose group has no New note", () => {
  const onNewNote = vi.fn();
  render(
    <NotesView notes={notes} collections={collections} onNewNote={onNewNote} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "New note in Course A" }));
  expect(onNewNote).toHaveBeenCalledWith("course-a");
  expect(
    screen.queryByRole("button", { name: "New note in No collection" }),
  ).toBeNull();
  expect(notesArea.nav).toBe("Notes");
});

test("empty home says so", () => {
  render(<NotesView notes={[]} collections={[]} />);
  expect(screen.getByText("No notes yet. Press C to write one.")).toBeTruthy();
});

const page: NotePageData = {
  id: "n-co",
  title: "Energy budget",
  collectionName: "Economics 101",
  edited: "now",
  saveState: "saved",
  body: [
    { type: "p", runs: [{ text: "CO = HR × SV", b: true }] },
    { type: "ul", indent: 0, runs: [{ text: "Heart rate" }] },
    { type: "todo", checked: true, runs: [{ text: "Read pp. 212" }] },
    { type: "img", runs: [], alt: "curve", row: "r1", col: 0 },
    { type: "p", runs: [{ text: "Stretch" }], row: "r1", col: 1 },
  ],
};

test("note page shows meta and blocks, session bar only in a session", () => {
  const onBack = vi.fn();
  const onStart = vi.fn();
  const { rerender } = render(
    <NotePageView note={page} onBack={onBack} onStartSession={onStart} />,
  );
  expect(screen.getByRole("heading", { name: "Energy budget" })).toBeTruthy();
  expect(screen.getByText("CO = HR × SV").tagName).toBe("B");
  expect(screen.getByText("Image · curve")).toBeTruthy();
  expect(screen.queryByText(/Session/)).toBeNull();
  fireEvent.click(screen.getByText("← Notes"));
  fireEvent.click(screen.getByRole("button", { name: "Start session" }));
  expect(onBack).toHaveBeenCalled();
  expect(onStart).toHaveBeenCalled();
  const onPause = vi.fn();
  rerender(
    <NotePageView
      note={page}
      session={{ timer: "18:20", paused: false, readAlong: true }}
      onTogglePause={onPause}
    />,
  );
  expect(screen.getByText("Session 18:20")).toBeTruthy();
  expect(screen.queryByText("← Notes")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
  expect(onPause).toHaveBeenCalled();
});

test("a titled note shows its title once; an untitled one shows Untitled once", () => {
  const titled: NotePageData = {
    ...page,
    body: [{ type: "h1", runs: [{ text: "Energy budget" }] }, ...page.body],
  };
  const { rerender } = render(<NotePageView note={titled} />);
  expect(screen.getAllByText("Energy budget")).toHaveLength(1);
  rerender(<NotePageView note={{ ...page, title: "Untitled" }} />);
  expect(screen.getAllByText("Untitled")).toHaveLength(1);
});

test("while the first read is in flight it says Loading, never the empty words", () => {
  const { container } = render(
    <NotesView notes={[]} collections={[]} loading />,
  );
  expect(container.textContent).toContain("Loading…");
  expect(container.textContent).not.toContain("No notes yet");
});
