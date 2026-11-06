import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { centralDate } from "../../domain/index.ts";
import { afterEach, expect, test, vi } from "vitest";
import { TodayHosted } from "./testHost.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status });
const soon = centralDate(Date.now() + 3 * 86_400_000);
const exam = {
  schema: 2,
  writer: "page",
  at: "2026-10-01T15:00:00Z",
  source: "test",
  title: "Exam 3",
  kind: "exam",
  course: "Biology 101",
  date: soon,
};

test("a Upcoming exam row opens its Detail with the plan line; Esc closes it", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("jobs")
        ? json({
            jobs: [
              {
                id: "j",
                kind: "prep_plan",
                state: "needs-you",
                goalId: "e3",
                summary: "Plan ready.",
              },
            ],
          })
        : url.includes("dayedits")
          ? json({}, 404)
          : url.includes("collection=exams")
            ? json({ docs: [{ id: "e3", data: exam }] })
            : json({ docs: [] }),
    ),
  );
  const onNavigate = vi.fn();
  render(<TodayHosted onNavigate={onNavigate} />);
  const row = await screen.findByText(/prep plan waiting for you/);
  expect(document.querySelector("[data-ui='detail']")).toBeNull();
  fireEvent.click(row);
  const detail = await waitFor(() => {
    const d = document.querySelector("[data-ui='detail']");
    expect(d).toBeTruthy();
    return d as HTMLElement;
  });
  expect(detail.textContent).toContain("Exam 3");
  expect(detail.textContent).not.toContain("Course");
  fireEvent.click(screen.getByText("Review the prep plan"));
  expect(onNavigate).toHaveBeenCalledWith("/library?open=e3");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(document.querySelector("[data-ui='detail']")).toBeNull();
  fireEvent.click(row);
  fireEvent.click(screen.getByLabelText("Close"));
  expect(document.querySelector("[data-ui='detail']")).toBeNull();
});

const two = [
  { id: "e3", data: exam },
  { id: "e4", data: { ...exam, title: "Exam 4", date: soon } },
];
const feed = (jobs: unknown[], extra: Record<string, unknown[]> = {}) =>
  vi.fn(async (url: string) =>
    url.includes("jobs")
      ? json({ jobs })
      : url.includes("dayedits")
        ? json({}, 404)
        : url.includes("collection=exams")
          ? json({ docs: extra.exams ?? two })
          : url.includes("collection=plans")
            ? json({ docs: extra.plans ?? [] })
            : json({ docs: [] }),
  );

test("a waiting plan shows only on the exam its job names", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    feed([
      {
        id: "j",
        kind: "prep_plan",
        state: "needs-you",
        goalId: "e4",
        summary: "x",
      },
    ]),
  );
  render(<TodayHosted />);
  await screen.findByText(/prep plan waiting for you/);
  expect(screen.getAllByText(/prep plan waiting for you/)).toHaveLength(1);
  fireEvent.click(screen.getByText(/prep plan waiting for you/));
  const detail = document.querySelector("[data-ui='detail']") as HTMLElement;
  expect(detail.textContent).toContain("Exam 4");
  expect(detail.textContent).toContain("waiting for you");
});

test("an exam whose plan is in force reads approved", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    feed([], {
      exams: [{ id: "e3", data: { ...exam, planId: "p1" } }, two[1]],
      plans: [{ id: "p1", data: { goal_id: "e3", state: "in_force" } }],
    }),
  );
  render(<TodayHosted />);
  await screen.findByText(/prep plan approved/);
  expect(screen.getAllByText(/prep plan approved/)).toHaveLength(1);
  expect(screen.queryByText(/waiting for you/)).toBeNull();
});

test("Today's exam Detail uses Library's words: date with days left, readiness, plan", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", feed([]));
  render(<TodayHosted onNavigate={vi.fn()} />);
  fireEvent.click((await screen.findAllByText("Exam 3"))[0]!);
  const detail = await waitFor(() => {
    const d = document.querySelector("[data-ui='detail']");
    expect(d).toBeTruthy();
    return d as HTMLElement;
  });
  expect(detail.textContent).toContain("in 3 days");
  expect(detail.textContent).toContain("none yet");
  expect(detail.textContent).toContain("no plan yet");
  expect(screen.getByText("Review the prep plan")).toBeTruthy();
});

test("an approved plan's session dated today lists on Today's Plan, and Start next starts it", async () => {
  localStorage.setItem("ev5.token", "t");
  const today = centralDate(new Date());
  const items = [
    {
      id: "pli_j-1",
      data: {
        plan_id: "p1",
        day: today,
        title: "Gather notes and make a review list",
        minutes: 30,
      },
    },
    {
      id: "pli_j-2",
      data: { plan_id: "p1", day: "2099-01-01", title: "Later", minutes: 10 },
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("jobs")
        ? json({ jobs: [] })
        : url.includes("dayedits")
          ? json({}, 404)
          : url.includes("collection=exams")
            ? json({ docs: [{ id: "e3", data: { ...exam, planId: "p1" } }] })
            : url.includes("collection=plan_items")
              ? json({ docs: items })
              : url.includes("collection=plans")
                ? json({
                    docs: [
                      { id: "p1", data: { goal_id: "e3", state: "in_force" } },
                    ],
                  })
                : json({ docs: [] }),
    ),
  );
  render(<TodayHosted />);
  await screen.findByText("Gather notes and make a review list");
  expect(screen.getByText("30m")).toBeTruthy();
  expect(screen.queryByText("Later")).toBeNull();
  expect(screen.queryByText(/Nothing planned/)).toBeNull();
  fireEvent.click(screen.getByText("Start next"));
  await screen.findByText("Started · Gather notes and make a review list");
});
