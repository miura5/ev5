import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { TodayScreen } from "./Today.screen.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status });
const soon = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("en-CA", {
  timeZone: "America/Chicago",
});
const exam = {
  schema: 2,
  writer: "page",
  at: "2026-10-01T15:00:00Z",
  source: "test",
  title: "Exam 3",
  kind: "unit",
  course: "NUR 112",
  date: soon,
};

test("a Coming up exam row opens its Detail with the plan line; Esc closes it", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("jobs")
        ? json({
            jobs: [
              {
                id: "j",
                kind: "study_plan",
                state: "needs-you",
                examId: "e3",
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
  render(<TodayScreen onNavigate={onNavigate} />);
  const row = await screen.findByText(/study plan waiting for you/);
  expect(document.querySelector("[data-ui='detail']")).toBeNull();
  fireEvent.click(row);
  const detail = await waitFor(() => {
    const d = document.querySelector("[data-ui='detail']");
    expect(d).toBeTruthy();
    return d as HTMLElement;
  });
  expect(detail.textContent).toContain("Exam 3");
  expect(detail.textContent).toContain("NUR 112");
  fireEvent.click(screen.getByText("Review the study plan"));
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
          : url.includes("collection=planedits")
            ? json({ docs: extra.planedits ?? [] })
            : json({ docs: [] }),
  );

test("a waiting plan shows only on the exam its job names", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    feed([
      {
        id: "j",
        kind: "study_plan",
        state: "needs-you",
        examId: "e4",
        summary: "x",
      },
    ]),
  );
  render(<TodayScreen />);
  await screen.findByText(/study plan waiting for you/);
  expect(screen.getAllByText(/study plan waiting for you/)).toHaveLength(1);
  fireEvent.click(screen.getByText(/study plan waiting for you/));
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
      planedits: [{ id: "e3", data: { plan: "p1" } }],
    }),
  );
  render(<TodayScreen />);
  await screen.findByText(/study plan approved/);
  expect(screen.getAllByText(/study plan approved/)).toHaveLength(1);
  expect(screen.queryByText(/waiting for you/)).toBeNull();
});

test("Today's exam Detail uses Library's words: date with days left, readiness, plan", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal("fetch", feed([]));
  render(<TodayScreen onNavigate={vi.fn()} />);
  fireEvent.click((await screen.findAllByText("Exam 3"))[0]!);
  const detail = await waitFor(() => {
    const d = document.querySelector("[data-ui='detail']");
    expect(d).toBeTruthy();
    return d as HTMLElement;
  });
  expect(detail.textContent).toContain("in 3 days");
  expect(detail.textContent).toContain("none yet");
  expect(detail.textContent).toContain("no plan yet");
  expect(screen.getByText("Review the study plan")).toBeTruthy();
});
