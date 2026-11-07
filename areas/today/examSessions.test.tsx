import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { centralDate } from "../../domain/index.ts";
import { goalRow, rowsAnswer, TodayHosted } from "./testHost.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status });
const soon = centralDate(Date.now() + 3 * 86_400_000);
const exam = goalRow({ date: soon });

function boot(jobs: unknown[], calls: string[] = []) {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") calls.push(`${url} ${String(init.body)}`);
      return url.includes("jobs")
        ? json({ jobs })
        : url.includes("dayedits")
          ? json({}, 404)
          : rowsAnswer(url, { goals: [exam] });
    }),
  );
  render(<TodayHosted />);
}

test("the exam Detail lists the waiting plan's sessions with weekday and date", async () => {
  boot([
    {
      id: "j",
      kind: "prep_plan",
      state: "needs-you",
      goalId: "e3",
      summary: "x",
      tasks: [
        { date: "2099-01-04", title: "Misses only", minutes: 10 },
        { date: "2099-01-02", title: "Unit conversion by weight", minutes: 25 },
      ],
    },
  ]);
  fireEvent.click(await screen.findByText(/prep plan waiting for you/));
  await screen.findByText("Proposed sessions");
  const rows = [
    ...document.querySelectorAll("[data-ui='detail'] [data-ui='row']"),
  ].map((r) => r.textContent);
  expect(rows).toEqual([
    "Unit conversion by weightFri Jan 225m",
    "Misses onlySun Jan 410m",
  ]);
  expect(screen.queryByText("Plan with E.V.")).toBeNull();
});

test("an exam with no plan offers Plan with E.V. in its Detail", async () => {
  const calls: string[] = [];
  boot([], calls);
  fireEvent.click((await screen.findAllByText("Exam 3"))[0] as HTMLElement);
  fireEvent.click(await screen.findByText("Plan with E.V."));
  await waitFor(() => expect(calls.join()).toContain("plan_with_ev"));
});
