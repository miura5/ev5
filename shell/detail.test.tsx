import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Shell } from "./Shell.tsx";

afterEach(cleanup);

const areas = [
  { id: "today", route: "/", nav: "Today", view: () => <h1>Today view</h1> },
  { id: "ask", route: "/ask", nav: "Ask E.V.", view: () => <h1>Ask view</h1> },
];

const panel = (title: string) => ({ title, properties: [] });

test("a view opens, replaces and clears the Detail through onDetail; Esc, close and leaving clear it", () => {
  const view = ({
    onDetail,
  }: {
    onDetail?: (d: ReturnType<typeof panel> | null) => void;
  }) => (
    <div>
      <button onClick={() => onDetail?.(panel("First"))}>open one</button>
      <button onClick={() => onDetail?.(panel("Second"))}>open two</button>
      <button onClick={() => onDetail?.(null)}>clear</button>
    </div>
  );
  const withView = [{ ...areas[0]!, view }, areas[1]!];
  const detail = () => document.querySelector("[data-ui='detail']");
  const { rerender } = render(
    <Shell path="/" onNavigate={vi.fn()} areas={withView} />,
  );
  expect(detail()).toBeNull();
  fireEvent.click(screen.getByText("open one"));
  expect(screen.getByRole("heading", { name: "First" })).toBeTruthy();
  fireEvent.click(screen.getByText("open two"));
  expect(screen.queryByRole("heading", { name: "First" })).toBeNull();
  expect(screen.getByRole("heading", { name: "Second" })).toBeTruthy();
  fireEvent.click(screen.getByText("clear"));
  expect(detail()).toBeNull();
  fireEvent.click(screen.getByText("open one"));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(detail()).toBeNull();
  fireEvent.click(screen.getByText("open one"));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(detail()).toBeNull();
  fireEvent.click(screen.getByText("open one"));
  rerender(<Shell path="/ask" onNavigate={vi.fn()} areas={withView} />);
  expect(detail()).toBeNull();
});

test("Esc on the Detail clears ?open= from the address, and leaves it when there is none", () => {
  const view = ({
    onDetail,
  }: {
    onDetail?: (d: ReturnType<typeof panel> | null) => void;
  }) => <button onClick={() => onDetail?.(panel("First"))}>open one</button>;
  const withView = [{ ...areas[0]!, view }, areas[1]!];
  const onNavigate = vi.fn();
  const { unmount } = render(
    <Shell path="/?open=abc" onNavigate={onNavigate} areas={withView} />,
  );
  fireEvent.click(screen.getByText("open one"));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(onNavigate).toHaveBeenCalledWith("/");
  unmount();
  const other = vi.fn();
  render(<Shell path="/" onNavigate={other} areas={withView} />);
  fireEvent.click(screen.getByText("open one"));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(other).not.toHaveBeenCalled();
});
