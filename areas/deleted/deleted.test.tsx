import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { deletedArea } from "./area.ts";
import { DeletedView, type DeletedItem } from "./Deleted.view.tsx";

afterEach(cleanup);

const items: DeletedItem[] = [
  { id: "n1", type: "note", title: "Cardiac drugs", deletedOn: "Nov 1", from: "NUR 112", daysLeft: 29 },
  { id: "c1", type: "collection", title: "Spanish", deletedOn: "Oct 30", daysLeft: 27 },
];

test("lists items with origin and days left, restore reports the id", () => {
  const onRestore = vi.fn();
  render(<DeletedView items={items} onRestore={onRestore} />);
  expect(screen.getByText("2 items")).toBeTruthy();
  expect(screen.getByText("deleted Nov 1 · from NUR 112")).toBeTruthy();
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
