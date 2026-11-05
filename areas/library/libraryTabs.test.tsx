import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryView } from "./Library.view.tsx";
import { LibraryScreen } from "./Library.screen.tsx";
import { TodayScreen } from "../today/Today.screen.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("the open tab is the only one marked selected, and moves on click", () => {
  render(<LibraryView practice={null} weakSpots={[]} exams={[]} />);
  const selected = () =>
    screen
      .getAllByRole("tab")
      .filter((t) => t.getAttribute("aria-selected") === "true")
      .map((t) => t.textContent);
  expect(selected()).toEqual(["Practice"]);
  fireEvent.click(screen.getByRole("tab", { name: /Exams/ }));
  expect(selected()).toEqual(["Exams0"]);
});

test("a count reads beside its tab, zero included", () => {
  render(
    <LibraryView
      practice={null}
      weakSpots={[]}
      exams={[
        {
          id: "x",
          title: "E",
          meta: "",
          when: "",
          course: "",
          mastery: { right: 1, shaky: 0, wrong: 0 },
          readiness: "1%",
        },
      ]}
    />,
  );
  expect(screen.getByRole("tab", { name: "Exams1" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Weak spots0" })).toBeTruthy();
});

for (const [name, Screen] of [
  ["Today", TodayScreen],
  ["Library", LibraryScreen],
] as const) {
  test(`${name}: while the first fetch is open, the heading and a loading line show`, async () => {
    localStorage.setItem("ev5.token", "t");
    const f = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", f);
    render(<Screen />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name }).textContent).toBe(name);
    expect(screen.getByText("Loading…")).toBeTruthy();
  });
}
