import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Detail } from "../../kit/index.ts";
import { dateDetail } from "./DateDetail.tsx";
import type { UpcomingDate } from "./types.ts";

afterEach(cleanup);

const date: UpcomingDate = {
  id: "g1",
  title: "Trip to Oaxaca",
  kind: "other",
  meta: "in 9 days",
  when: "Nov 15",
  readiness: { ready: 0, shaky: 0, weak: 0 },
};

test("Today's date Detail asks the registry: no plan for other, Plan with E.V. for exam, and Kind sets the kind", () => {
  const onKind = vi.fn();
  const onPlanWithEv = vi.fn();
  const h = { onKind, onPlanWithEv, onReviewPlan: vi.fn(), onClose: vi.fn() };
  render(<Detail {...dateDetail(date, h)} />);
  expect(screen.queryByText("Plan with E.V.")).toBeNull();
  expect(screen.queryByText("Review the prep plan")).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "Exam" }));
  expect(onKind).toHaveBeenCalledWith("exam");
  cleanup();
  render(<Detail {...dateDetail({ ...date, kind: "exam" }, h)} />);
  fireEvent.click(screen.getByText("Plan with E.V."));
  expect(onPlanWithEv).toHaveBeenCalled();
});
