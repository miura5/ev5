import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { todayArea } from "./area.ts";
import { TodayView } from "./Today.view.tsx";
import type { TodayProps } from "./types.ts";

afterEach(cleanup);

const props = (over: Partial<TodayProps> = {}): TodayProps => ({
  dateLabel: "Monday, November 2",
  say: {
    lead: "Exam 3 is Thursday.",
    rest: "Your weakest spot is oral liquid doses.",
    source: "from Weak spots",
  },
  plan: [
    {
      id: "p1",
      title: "Review · 8 questions",
      meta: "morning set",
      est: "10m",
      done: false,
      tone: "ok",
    },
    {
      id: "p2",
      title: "Oral liquid doses",
      meta: "from your plan",
      est: "20m",
      done: true,
      tone: "info",
    },
  ],
  proposal: { text: "5 dosage-by-weight problems tonight · 10m" },
  upcoming: [
    {
      id: "d1",
      title: "NUR 112 · Exam 3",
      meta: "58% ready",
      when: "Thu",
      tone: "info",
      readiness: { ready: 40, shaky: 20, weak: 40 },
    },
  ],
  thisWeek: [
    { id: "w1", title: "Weekly review", meta: "5 h 10 m studied", when: "Sun" },
  ],
  onStartNext: vi.fn(),
  onOpen: vi.fn(),
  onTick: vi.fn(),
  onAddPlan: vi.fn(async () => true),
  onAddDate: vi.fn(async () => true),
  onAccept: vi.fn(),
  onEdit: vi.fn(),
  onDismiss: vi.fn(),
  ...over,
});

test("today shows its sections and counts what is left", () => {
  render(<TodayView {...props()} />);
  expect(todayArea.route).toBe("/today");
  for (const name of ["Plan", "Coming up", "This week"])
    expect(screen.getByRole("region", { name })).toBeTruthy();
  expect(screen.getByText("Exam 3 is Thursday.")).toBeTruthy();
  expect(
    screen
      .getByRole("region", { name: "Plan" })
      .querySelector(".ev-today-sec-head .ev-today-meta")?.textContent,
  ).toBe("1");
});

test("start next, open and the suggestion call back", () => {
  const p = props();
  render(<TodayView {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Start next/ }));
  fireEvent.click(screen.getByText("Oral liquid doses"));
  fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
  fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(p.onStartNext).toHaveBeenCalled();
  expect(p.onOpen).toHaveBeenCalledWith("p2");
  expect(p.onAccept).toHaveBeenCalled();
  expect(p.onEdit).toHaveBeenCalled();
  expect(p.onDismiss).toHaveBeenCalled();
});

test("empty states, no suggestion, Start next disabled when all done", () => {
  render(
    <TodayView
      {...props({ plan: [], proposal: undefined, upcoming: [], thisWeek: [] })}
    />,
  );
  expect(screen.getByText("Nothing planned for today.")).toBeTruthy();
  expect(screen.getByText("No dates coming up.")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "This week" })).toBeNull();
  expect(
    (screen.getByRole("button", { name: /Start next/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test("Today shows one spend line when the alert is set, none otherwise", () => {
  const { rerender } = render(<TodayView {...props()} />);
  expect(screen.queryByText(/monthly limit/)).toBeNull();
  rerender(
    <TodayView
      {...props({
        alert: "E.V. has used $0.85 of the $1.00 monthly limit (80%).",
      })}
    />,
  );
  expect(screen.getAllByText(/monthly limit/)).toHaveLength(1);
});

test("the tick on a plan item asks for the opposite state", () => {
  const p = props();
  render(<TodayView {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Mark done: Review/ }));
  fireEvent.click(
    screen.getByRole("button", { name: /Mark not done: Oral liquid/ }),
  );
  expect(p.onTick).toHaveBeenNthCalledWith(1, "p1", true);
  expect(p.onTick).toHaveBeenNthCalledWith(2, "p2", false);
});
