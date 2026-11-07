import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../commands/client.ts", async (orig) => ({
  ...(await orig<object>()),
  call: vi.fn(async () => ({
    ok: false,
    status: 409,
    reason: "That changed elsewhere.",
  })),
}));
import { Shell } from "./Shell.tsx";
import type { AreaEntry } from "./areas.ts";

afterEach(cleanup);

let boom = true;
const view: AreaEntry["view"] = () => {
  if (boom) throw new Error("x");
  return <p>fine</p>;
};
const areas = [
  { id: "today", route: "/", nav: "Today", view },
  { id: "library", route: "/library", nav: "Library", view: () => <p>lib</p> },
];

test("a throwing screen shows a quiet line; the sidebar stays and Try again recovers", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  boom = true;
  render(<Shell path="/" onNavigate={vi.fn()} areas={areas} />);
  expect(screen.getByText(/hit a problem/)).toBeTruthy();
  expect(screen.getByText("Library")).toBeTruthy();
  boom = false;
  fireEvent.click(screen.getByText("Try again"));
  expect(screen.getByText("fine")).toBeTruthy();
});

test("navigating clears the error", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  boom = true;
  const { rerender } = render(
    <Shell path="/" onNavigate={vi.fn()} areas={areas} />,
  );
  expect(screen.getByText(/hit a problem/)).toBeTruthy();
  rerender(<Shell path="/library" onNavigate={vi.fn()} areas={areas} />);
  expect(screen.getByText("lib")).toBeTruthy();
});

test("a palette command the server refuses shows a Not saved toast with the reason", async () => {
  boom = false;
  render(<Shell path="/" onNavigate={vi.fn()} areas={areas} />);
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  fireEvent.click(await screen.findByText("Add a plan item"));
  await waitFor(() =>
    expect(screen.getByText("Not saved: That changed elsewhere.")).toBeTruthy(),
  );
});
