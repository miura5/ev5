import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SessionsScreen } from "./Sessions.screen.tsx";
import { SessionView } from "./Sessions.view.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("the check shows its answer only when given one, and Just tell me calls back", () => {
  const onTellMe = vi.fn();
  const base = {
    title: "T",
    seconds: 0,
    paused: false,
    question: "Why?",
    checks: [],
    onTogglePause: vi.fn(),
    onEnd: vi.fn(),
    onToggleCheck: vi.fn(),
    onAnswer: vi.fn(),
    onTellMe,
  };
  const { rerender } = render(<SessionView {...base} />);
  fireEvent.click(screen.getByText("Just tell me"));
  expect(onTellMe).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Because.")).toBeNull();
  rerender(<SessionView {...base} answer="Because." />);
  expect(screen.getByText("Because.")).toBeTruthy();
});

test("the screen has no open check yet, so no Just tell me tap is offered there", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ docs: [] }),
      }),
  );
  render(<SessionsScreen />);
  await waitFor(() => expect(screen.getByText("Pause")).toBeTruthy());
  expect(screen.queryByText("Just tell me")).toBeNull();
});
