import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { CollectionView } from "./Collection.view.tsx";

afterEach(cleanup);

test("a row opens its menu on right-click and the . key, and Move picks a collection", async () => {
  const onMove = vi.fn();
  render(
    <CollectionView
      title="NUR 112"
      dates={[]}
      nested={[]}
      items={[{ id: "n1", type: "note", title: "Med math" }]}
      targets={[
        { id: "c1", title: "NUR 112" },
        { id: "c2", title: "BIO 201" },
      ]}
      onItemAction={() => undefined}
      onMove={onMove}
    />,
  );
  fireEvent.keyDown(document.querySelector<HTMLElement>('[data-ui="row"]')!, {
    key: ".",
  });
  expect((await screen.findByRole("menu")).textContent).toContain("Move");
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });
  fireEvent.contextMenu(screen.getByText("Med math"));
  fireEvent.click(await screen.findByRole("menuitem", { name: /Move/ }));
  fireEvent.click(await screen.findByRole("option", { name: /BIO 201/ }));
  expect(onMove).toHaveBeenCalledWith("n1", "c2");
});
