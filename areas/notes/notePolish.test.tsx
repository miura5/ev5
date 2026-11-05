import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { NoteEditor } from "./parts/NoteEditor.tsx";
import { NotePageView } from "./NotePage.view.tsx";

afterEach(cleanup);

const LINE = "Start writing, or type # for a heading";

test("an empty note carries the placeholder line, not saved into the note", () => {
  const { container } = render(<NoteEditor blocks={[]} onChange={() => {}} />);
  const el = container.querySelector(".ev-notes-empty");
  expect(el?.getAttribute("data-placeholder")).toBe(LINE);
  expect(container.textContent).not.toContain(LINE);
});

test("the placeholder is gone once the note has text", () => {
  const { container } = render(
    <NoteEditor
      blocks={[{ type: "p", runs: [{ text: "Hi" }] }]}
      onChange={() => {}}
    />,
  );
  expect(container.querySelector(".ev-notes-empty")).toBeNull();
});

test("Make cards and Start session say what they do", () => {
  render(
    <NotePageView
      note={
        {
          title: "T",
          body: [],
          edited: "now",
          saveState: "saved",
          collectionName: null,
        } as never
      }
      onMakeCards={() => {}}
      onStartSession={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "Make cards" }).title).toBe(
    "Start a set from this note; E.V. drafts, you keep or drop",
  );
  expect(screen.getByRole("button", { name: "Start session" }).title).toBe(
    "Start a study session",
  );
});
