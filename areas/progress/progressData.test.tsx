import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProgressScreen } from "./Progress.screen.tsx";
import { mapProgress } from "./useProgress.ts";
import { trendText } from "./text.ts";
import { weeklyAccuracy } from "./series.ts";

const NOW = Date.UTC(2026, 10, 5, 12);
const ans = (id: string, at: number, correct: boolean) => ({
  id,
  data: {
    setId: "s1",
    answers: { [id]: { k: { at: new Date(at).toISOString(), correct } } },
  },
});

test("mapProgress with no answers reads as empty", () => {
  expect(mapProgress([], NOW)).toMatchObject({
    accuracy: null,
    hasAnswers: false,
  });
});

beforeEach(() => {
  localStorage.setItem("ev5.token", "t");
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function stub(answers: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      const docs = String(u).includes("collection=answers") ? answers : [];
      return new Response(JSON.stringify({ docs }), { status: 200 });
    }),
  );
}

test("the screen shows the accuracy line and no Minutes section", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  stub([ans("i1", NOW - 1000, true)]);
  render(<ProgressScreen />);
  await waitFor(() => expect(screen.getByText("100%")).toBeTruthy());
  expect(screen.getByText("Retrieval accuracy")).toBeTruthy();
  expect(screen.queryByText(/Minutes/)).toBeNull();
  expect(
    screen.getByRole("img", { name: "First-try accuracy by week" }),
  ).toBeTruthy();
  vi.useRealTimers();
});

test("no answers keeps the empty sentence", async () => {
  stub([]);
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
  expect(pts.map((p) => p.label)).toEqual([
    "Sep 13",
    "20",
    "27",
    "Oct 4",
    "11",
    "18",
    "25",
    "Nov 1",
  ]);
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

test("while the first read is in flight it says Loading, never the empty line", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  const { container } = render(<ProgressScreen />);
  expect(container.textContent).toContain("Loading…");
  expect(container.textContent).not.toContain("accuracy over time");
});
