import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProgressScreen } from "./Progress.screen.tsx";
import { endedMinutes, mapProgress } from "./useProgress.ts";
import { endedMinutesText, trendText } from "./text.ts";
import { dailyMinutes, weeklyAccuracy, windowTotals } from "./series.ts";

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
    [
      {
        id: "s",
        data: {
          status: "ended",
          minutes: 30,
          endedAt: new Date(NOW - 1000).toISOString(),
        },
      },
    ],
  );
  render(<ProgressScreen />);
  await waitFor(() => expect(screen.getByText("100%")).toBeTruthy());
  expect(screen.getByText("Retrieval accuracy")).toBeTruthy();
  expect(screen.getByText("Study minutes, last 7 days")).toBeTruthy();
  expect(screen.getByText("30m")).toBeTruthy();
  expect(screen.getByText(/1 session · 30m in 1 session in all/)).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "First-try accuracy by week" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "Study minutes by day" }),
  ).toBeTruthy();
  vi.useRealTimers();
});

test("no answers keeps the empty sentence", async () => {
  stub([], []);
  render(<ProgressScreen />);
  await waitFor(() =>
    expect(screen.getByText(/once you have answered some/)).toBeTruthy(),
  );
});

test("weekly accuracy buckets first tries into 8 weeks, newest last", () => {
  const DAY = 86_400_000;
  const pts = weeklyAccuracy(
    [
      ans("i1", NOW - DAY, true),
      ans("i2", NOW - 2 * DAY, false),
      ans("i3", NOW - 9 * DAY, true),
    ],
    NOW,
  );
  expect(pts).toHaveLength(8);
  expect(pts[7]?.value).toBe(50);
  expect(pts[6]?.value).toBe(100);
  expect(pts[0]?.value).toBe(0);
  expect(pts[0]?.title).toMatch(/no answers/);
});

test("daily minutes put each ended session on its Central day, today last", () => {
  const DAY = 86_400_000;
  const s = (m: number, at: number) => ({
    id: String(at),
    data: { status: "ended", minutes: m, endedAt: new Date(at).toISOString() },
  });
  const docs = [
    s(30, NOW - 1000),
    s(20, NOW - 2000),
    s(45, NOW - 2 * DAY),
    s(99, NOW - 20 * DAY),
  ];
  const days = dailyMinutes(docs, NOW);
  expect(days).toHaveLength(7);
  expect(days[6]).toMatchObject({ label: "Today", value: 50 });
  expect(days[4]?.value).toBe(45);
  expect(windowTotals(docs, NOW)).toEqual({ minutes: 95, sessions: 3 });
});

test("the accuracy trend reads as points, as in the mock-up", () => {
  expect(trendText("72", "up from 69%")).toBe(
    "up 3 points on the 2 weeks before",
  );
  expect(trendText("60", "down from 61%")).toBe(
    "down 1 point on the 2 weeks before",
  );
  expect(trendText("72", "other")).toBe("other");
});
