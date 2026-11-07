import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TodayView } from "./Today.view.tsx";
import type { TodayProps } from "./types.ts";
import { useToday } from "./useToday.ts";
import { rowsAnswer } from "./testHost.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const props = (over: Partial<TodayProps> = {}): TodayProps => ({
  dateLabel: "Monday, November 2",
  say: { lead: "Nothing planned.", rest: "Add something." },
  plan: [],
  upcoming: [],
  thisWeek: [],
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

test("Add on Plan (and key C) opens a form that adds through onAddPlan", async () => {
  const p = props();
  render(<TodayView {...p} />);
  expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "c" });
  const form = screen.getByRole("form", { name: "Add to today" });
  const add = within(form).getByRole("button", {
    name: "Add",
  }) as HTMLButtonElement;
  expect(add.disabled).toBe(true);
  fireEvent.change(within(form).getByLabelText("Title"), {
    target: { value: " Flash cards " },
  });
  fireEvent.click(add);
  await waitFor(() => expect(p.onAddPlan).toHaveBeenCalledWith("Flash cards"));
  await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
});

test("key C is ignored while typing, and a failed add keeps the form open", async () => {
  const p = props({ onAddPlan: vi.fn(async () => false) });
  render(<TodayView {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  const title = screen.getByLabelText("Title");
  fireEvent.keyDown(title, { key: "c" });
  expect(screen.getAllByRole("form")).toHaveLength(1);
  fireEvent.change(title, { target: { value: "x" } });
  fireEvent.submit(screen.getByRole("form"));
  await waitFor(() => expect(p.onAddPlan).toHaveBeenCalled());
  expect(screen.getByRole("form")).toBeTruthy();
  fireEvent.keyDown(title, { key: "Escape" });
  expect(screen.queryByRole("form")).toBeNull();
});

test("Add date on Upcoming needs a title and a date, then calls onAddDate", async () => {
  const p = props();
  render(<TodayView {...p} />);
  expect(screen.getByRole("region", { name: "Upcoming" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Add date" }));
  const form = screen.getByRole("form", { name: "Add a date" });
  fireEvent.change(within(form).getByLabelText("Title"), {
    target: { value: "Unit quiz" },
  });
  const add = within(form).getByRole("button", {
    name: "Add",
  }) as HTMLButtonElement;
  expect(add.disabled).toBe(true);
  fireEvent.change(within(form).getByLabelText("Date"), {
    target: { value: "2026-11-12" },
  });
  fireEvent.click(add);
  await waitFor(() =>
    expect(p.onAddDate).toHaveBeenCalledWith("Unit quiz", "2026-11-12"),
  );
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status });

test("addPlan and addDate call plan.create and date.create, then Today reads itself again", async () => {
  localStorage.setItem("ev5.token", "t");
  const calls: string[] = [];
  let reads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("commands/")) {
        calls.push(`${url} ${init?.body}`);
        return json({ mode: "direct", result: {} });
      }
      if (url.includes("/goals")) reads++;
      if (url.includes("jobs")) return json({ jobs: [] });
      return rowsAnswer(url);
    }),
  );
  const { result } = renderHook(() => useToday());
  await waitFor(() => expect(result.current.data).toBeTruthy());
  let a = false;
  let b = false;
  await act(async () => {
    a = await result.current.addPlan("Flash cards");
    b = await result.current.addDate("Quiz", "2026-11-12");
  });
  expect([a, b]).toEqual([true, true]);
  expect(calls[0]).toContain("commands/plan.create");
  expect(calls[0]).toContain('"title":"Flash cards"');
  expect(calls[1]).toContain("commands/date.create");
  expect(calls[1]).toContain('"date":"2026-11-12"');
  await waitFor(() => expect(reads).toBeGreaterThan(1));
});

test("an add the server refuses resolves false", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("commands/")
        ? json({ error: "no" }, 400)
        : url.includes("jobs")
          ? json({ jobs: [] })
          : rowsAnswer(url),
    ),
  );
  const { result } = renderHook(() => useToday());
  await waitFor(() => expect(result.current.data).toBeTruthy());
  let ok = true;
  await act(async () => {
    ok = await result.current.addPlan("x");
  });
  expect(ok).toBe(false);
});
