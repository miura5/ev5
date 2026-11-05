import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProgressScreen } from "./Progress.screen.tsx";
import { endedMinutes, mapProgress } from "./useProgress.ts";
import { endedMinutesText } from "./text.ts";

const NOW = Date.UTC(2026, 10, 5, 12);
const ans = (id: string, at: number, correct: boolean) => ({
  id,
  data: {
    setId: "s1",
    answers: { [id]: { k: { at: new Date(at).toISOString(), correct } } },
  },
});

test("ended-session minutes count only ended sessions with minutes", () => {
  const docs = [
    { id: "a", data: { status: "ended", minutes: 50 } },
    { id: "b", data: { status: "running", minutes: 20 } },
    { id: "c", data: { status: "ended" } },
    { id: "d", data: { status: "ended", minutes: 70 } },
  ];
  expect(endedMinutes(docs)).toEqual({ minutes: 120, sessions: 2 });
  expect(endedMinutesText(120, 2)).toBe("2h 0m in 2 sessions");
  expect(endedMinutesText(45, 1)).toBe("45m in 1 session");
});

test("mapProgress with no answers reads as empty", () => {
  expect(mapProgress([], [], NOW)).toMatchObject({
    accuracy: null,
    hasAnswers: false,
    minutes: 0,
  });
});

beforeEach(() => {
  localStorage.setItem("ev5.token", "t");
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function stub(answers: unknown[], sessions: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      const docs = String(u).includes("collection=answers")
        ? answers
        : sessions;
      return new Response(JSON.stringify({ docs }), { status: 200 });
    }),
  );
}

test("the screen shows the accuracy line and session minutes", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  stub(
    [ans("i1", NOW - 1000, true)],
    [{ id: "s", data: { status: "ended", minutes: 30 } }],
  );
  render(<ProgressScreen />);
  await waitFor(() => expect(screen.getByText("100%")).toBeTruthy());
  expect(screen.getByText("30m in 1 session")).toBeTruthy();
  vi.useRealTimers();
});

test("no answers keeps the empty sentence", async () => {
  stub([], []);
  render(<ProgressScreen />);
  await waitFor(() =>
    expect(screen.getByText(/once you have answered some/)).toBeTruthy(),
  );
});
