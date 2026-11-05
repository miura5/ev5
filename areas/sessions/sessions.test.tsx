import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { sessionsArea } from "./area.ts";
import {
  SessionView,
  formatTimer,
  type SessionViewProps,
} from "./Sessions.view.tsx";

afterEach(cleanup);

const base = (over: Partial<SessionViewProps> = {}): SessionViewProps => ({
  title: "Cardiac output",
  meta: "BIO 201",
  seconds: 1100,
  paused: false,
  checks: [
    { id: "c1", text: "Read pp. 212-219", done: true },
    { id: "c2", text: "Draw the curve", done: false },
  ],
  onTogglePause: vi.fn(),
  onEnd: vi.fn(),
  onToggleCheck: vi.fn(),
  onAnswer: vi.fn(),
  onTellMe: vi.fn(),
  ...over,
});

test("the bar shows the timer, read-along, and pause and end act", () => {
  const p = base();
  render(<SessionView {...p} />);
  expect(formatTimer(1100)).toBe("18:20");
  expect(screen.getByText("18:20")).toBeTruthy();
  expect(screen.getByText("read-along on")).toBeTruthy();
  fireEvent.click(screen.getByText("Pause"));
  fireEvent.click(screen.getByText("End"));
  expect(p.onTogglePause).toHaveBeenCalled();
  expect(p.onEnd).toHaveBeenCalled();
  expect(sessionsArea.nav).toBe("Sessions");
});

test("paused offers Resume, and checks toggle", () => {
  const p = base({ paused: true });
  render(<SessionView {...p} />);
  expect(screen.getByText("Resume")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Draw the curve"));
  expect(p.onToggleCheck).toHaveBeenCalledWith("c2");
});

test("a check sends the answer in her words or lets the user be told", () => {
  const p = base({ question: "Why does stroke volume rise?" });
  render(<SessionView {...p} />);
  fireEvent.click(screen.getByText("Turn over"));
  expect(p.onAnswer).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Your answer"), {
    target: { value: " stretch " },
  });
  fireEvent.click(screen.getByText("Turn over"));
  expect(p.onAnswer).toHaveBeenCalledWith("stretch");
  fireEvent.click(screen.getByText("Just tell me"));
  expect(p.onTellMe).toHaveBeenCalled();
});
