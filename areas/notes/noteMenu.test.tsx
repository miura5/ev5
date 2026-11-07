import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { NotePageView } from "./NotePage.view.tsx";

afterEach(cleanup);

test("the note page menu leaves out Open and has one Delete", async () => {
  render(
    <NotePageView
      note={{
        id: "a",
        title: "Unit maths",
        collectionName: "Course A",
        edited: "today",
        saveState: "saved",
        body: [],
      }}
      collections={[{ id: "c1", title: "Course A", parentId: null }]}
      collectionId="c1"
      onPin={() => undefined}
      onDelete={() => undefined}
    />,
  );
  expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  fireEvent.contextMenu(screen.getByText(/edited today/));
  await screen.findByRole("menu");
  expect(screen.queryByRole("menuitem", { name: "Open" })).toBeNull();
  expect(screen.getAllByRole("menuitem", { name: /Delete/ }).length).toBe(1);
});

test("the note page's dots sit at the end of its actions line, so the menu opens beside them", () => {
  const { container } = render(
    <NotePageView
      note={{
        id: "a",
        title: "Unit maths",
        collectionName: "Course A",
        edited: "today",
        saveState: "saved",
        body: [],
      }}
      collections={[{ id: "c1", title: "Course A", parentId: null }]}
      collectionId="c1"
      onPin={() => undefined}
      onDelete={() => undefined}
    />,
  );
  const dots = screen.getByRole("button", { name: "Actions for Unit maths" });
  const line = container.querySelector(".kit-head-actions");
  expect(line?.contains(dots)).toBe(true);
  expect(line?.lastElementChild).toBe(dots);
});
