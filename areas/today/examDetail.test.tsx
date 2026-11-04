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
  expect(onNavigate).toHaveBeenCalledWith("/activity");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(document.querySelector("[data-ui='detail']")).toBeNull();
  fireEvent.click(row);
  fireEvent.click(screen.getByLabelText("Close"));
  expect(document.querySelector("[data-ui='detail']")).toBeNull();
});
