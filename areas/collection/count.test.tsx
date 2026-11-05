import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { CollectionView } from "./Collection.view.tsx";

afterEach(cleanup);

test("a collection with one entry says 1 item", () => {
  render(
    <CollectionView
      title="C"
      dates={[]}
      nested={[]}
      items={[{ id: "a", title: "A", kind: "note" } as never]}
    />,
  );
  expect(screen.getByText(/Collection · 1 item$/)).toBeTruthy();
});
