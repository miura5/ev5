import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExamPlanDetail } from "./ExamPlan.detail.tsx";

afterEach(cleanup);

test("a draft plan answers on one line: Approve, Ask for changes (secondary), Put away; sessions put the day in its own column", () => {
  render(
    <ExamPlanDetail
      startOpen
      exam={{
        id: "x",
        title: "Exam",
        when: "Nov 12 · in 8 days",
        course: "NUR 112",
        readiness: "none yet",
        plan: "draft waiting for you",
        planState: "draft",
        planId: "p",
        proposals: [],
        sessions: [{ date: "2026-11-10", title: "Dosage", minutes: 25 }],
      }}
    />,
  );
  const ask = screen.getByRole("button", { name: "Ask for changes" });
  expect(ask.getAttribute("data-kind")).toBe("secondary");
  const line = ask.parentElement as HTMLElement;
  expect(
    [...line.querySelectorAll("button")].map((b) => b.textContent),
  ).toEqual(["Approve", "Ask for changes", "Put away"]);
  expect(screen.queryByLabelText("What should change?")).toBeNull();
  fireEvent.click(ask);
  expect(screen.getByLabelText("What should change?")).toBeTruthy();
  expect(screen.getByText("Tue").className).toContain("ev-library-day");
});
