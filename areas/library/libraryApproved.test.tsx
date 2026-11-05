import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExamPlanDetail } from "./testHost.tsx";

afterEach(cleanup);

const exam = {
  id: "x1",
  title: "Exam Three",
  when: "Tue",
  course: "NUR 112",
  readiness: "none yet",
  plan: "in force",
  planState: "approved" as const,
  planId: "plan-j1",
  proposals: [],
  sessions: [
    { date: "2099-01-02", title: "Review heart sounds", minutes: 30 },
    { date: "2099-01-03", title: "Practice set", minutes: 20 },
  ],
};

test("after Approve the Detail lists the sessions and says how many were added", () => {
  render(<ExamPlanDetail exam={exam} />);
  expect(
    screen.getByText("Approved, 2 sessions added to your plan"),
  ).toBeTruthy();
  expect(screen.getByText("Review heart sounds")).toBeTruthy();
  expect(screen.getByText("30m")).toBeTruthy();
  expect(screen.queryByText("The sessions are not shown here yet.")).toBeNull();
  expect(screen.queryByText("Approve")).toBeNull();
});
