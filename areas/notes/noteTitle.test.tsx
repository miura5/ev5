import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { NotesScreen } from "./Notes.screen.tsx";

test("the note page has no browser Title box or Save button", () => {
  render(<NotesScreen />);
  expect(screen.queryByLabelText("Title")).toBeNull();
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
});
