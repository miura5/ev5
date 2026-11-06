import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ExamPlanDetail } from "./testHost.tsx";

afterEach(cleanup);

const date = {
  id: "g1",
  title: "Half marathon",
  kind: "other",
  when: "Sat, Dec 5 · in 30 days",
  readiness: "none yet",
  plan: "no plan yet",
  proposals: [],
};

test("a date of a kind with no prep plan shows its Kind and no plan; picking Exam sets the kind", () => {
  const onKind = vi.fn();
  render(<ExamPlanDetail exam={date} onKind={onKind} />);
  expect(screen.queryByText("Plan with E.V.")).toBeNull();
  expect(screen.queryByText("Review the prep plan")).toBeNull();
  expect(screen.queryByText("no plan yet")).toBeNull();
  expect(
    screen.getByRole("radio", { name: "Other" }).getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("radio", { name: "Exam" }));
  expect(onKind).toHaveBeenCalledWith("exam");
});

test("a date of kind exam offers Plan with E.V.; a kind outside the registry reads as Other", () => {
  render(<ExamPlanDetail exam={{ ...date, kind: "exam" }} />);
  expect(screen.getByText("Plan with E.V.")).toBeTruthy();
  cleanup();
  render(<ExamPlanDetail exam={{ ...date, kind: "midterm" }} />);
  expect(screen.queryByText("Plan with E.V.")).toBeNull();
  expect(
    screen.getByRole("radio", { name: "Other" }).getAttribute("aria-checked"),
  ).toBe("true");
});
