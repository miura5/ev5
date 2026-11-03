import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Shell } from "./Shell.tsx";

const areas = [
  { id: "today", route: "/", nav: "Today", view: () => <h1>Today view</h1> },
  { id: "ask", route: "/ask", nav: "Ask E.V.", view: () => <h1>Ask view</h1> },
];

test("the sidebar is built from the areas and mounts the current view", () => {
  const onNavigate = vi.fn();
  render(<Shell path="/ask" onNavigate={onNavigate} areas={areas} />);
  expect(screen.getByText("Ask view")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(onNavigate).toHaveBeenCalledWith("/");
});

test("pins, the deleted count and the Detail panel show only when there is something", () => {
  const onOpenPin = vi.fn();
  const { rerender } = render(
    <Shell path="/" onNavigate={vi.fn()} areas={areas} />,
  );
  expect(screen.queryByText("Pinned")).toBeNull();
  expect(document.querySelector("[data-ui='detail']")).toBeNull();
  rerender(
    <Shell
      path="/"
      onNavigate={vi.fn()}
      areas={areas}
      pins={[{ id: "n1", title: "Heart notes", type: "note" }]}
      onOpenPin={onOpenPin}
      deletedCount={2}
      detail={{ title: "Heart notes", properties: [] }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Heart notes/ }));
  expect(onOpenPin).toHaveBeenCalledWith("n1");
  expect(screen.getByText("2")).toBeTruthy();
  expect(document.querySelector("[data-ui='detail']")).toBeTruthy();
});

test("⌘K opens the palette, runs a place and Esc closes it", () => {
  const onNavigate = vi.fn();
  render(<Shell path="/" onNavigate={onNavigate} areas={areas} />);
  fireEvent.keyDown(window, { key: "k", metaKey: true });
  fireEvent.click(screen.getByRole("option", { name: "Ask E.V." }));
  expect(onNavigate).toHaveBeenCalledWith("/ask");
  expect(document.querySelector("[data-ui='palette']")).toBeNull();
});
