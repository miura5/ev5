import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { deletedArea } from "./area.ts";
import { DeletedView, type DeletedItem } from "./Deleted.view.tsx";

afterEach(cleanup);

const items: DeletedItem[] = [
  { id: "n1", type: "note", title: "Cardiac drugs", deletedOn: "Nov 1", from: "Biology 101", daysLeft: 29 },
  { id: "c1", type: "collection", title: "Spanish", deletedOn: "Oct 30", daysLeft: 27 },
];

test("lists items with origin and days left, restore reports the id", () => {
  const onRestore = vi.fn();
  render(<DeletedView items={items} onRestore={onRestore} />);
  expect(screen.getByText("2 items")).toBeTruthy();
  expect(screen.getByText("deleted Nov 1 · from Biology 101")).toBeTruthy();
  expect(screen.getByText("27 days left")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Restore Spanish"));
  expect(onRestore).toHaveBeenCalledWith("c1");
  expect(screen.queryByText(/forever/i)).toBeNull();
  expect(deletedArea.route).toBe("/deleted");
});

test("empty says Nothing here", () => {
  render(<DeletedView items={[]} />);
  expect(screen.getByText("Nothing here.")).toBeTruthy();
});

test("a set item and a note read as title plus kind, with the count on its own line", () => {
  render(
    <DeletedView
      items={[
        { id: "set_items/item_1", type: "questions", title: "Which lab is highest priority?", kind: "Set question", deletedOn: "Nov 1", daysLeft: 29 },
        { id: "notes/n1", type: "note", title: "Untitled", kind: "Note", deletedOn: "Nov 1", daysLeft: 29 },
      ]}
    />,
  );
  expect(screen.getByText("Which lab is highest priority?")).toBeTruthy();
  expect(screen.getByText("Set question · deleted Nov 1")).toBeTruthy();
  expect(screen.getByText("Note · deleted Nov 1")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("2 items");
  expect(document.body.textContent).not.toMatch(/set_items|notes\/n1/);
});
