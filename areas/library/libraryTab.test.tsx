import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { LibraryView } from "./Library.view.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const selected = () =>
  screen
    .getAllByRole("tab")
    .filter((t) => t.getAttribute("aria-selected") === "true")
    .map((t) => t.textContent);

test("an initial tab lights that tab (an exam opened by a link lights Exams)", () => {
  render(
    <LibraryView
      practice={null}
      weakSpots={[]}
      exams={[]}
      initialTab="exams"
    />,
  );
  expect(selected()).toEqual(["Exams0"]);
});

test("the tab he left on survives a reload", () => {
  const first = render(
    <LibraryView practice={null} weakSpots={[]} exams={[]} />,
  );
  fireEvent.click(screen.getByRole("tab", { name: /Sets/ }));
  first.unmount();
  render(<LibraryView practice={null} weakSpots={[]} exams={[]} />);
  expect(selected()).toEqual(["Sets0"]);
});
