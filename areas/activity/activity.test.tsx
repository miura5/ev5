import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { activityArea } from "./area.ts";
import { ActivityView, type ActivityJob } from "./Activity.view.tsx";

afterEach(cleanup);

const jobs: ActivityJob[] = [
  { id: "a", title: "Study plan", state: "needs-you", reason: "Rate your confidence", summary: "x" },
  { id: "b", title: "Mock exam", state: "running", summary: "Writing mock exam" },
  { id: "c", title: "Practice set", state: "failed", reason: "The model was unreachable", summary: "y" },
  { id: "d", title: "Morning", state: "done", summary: "Morning is done." },
];

test("jobs sit in their sections and failed shows its reason", () => {
  render(<ActivityView jobs={jobs} />);
  const needs = document.querySelector('[data-section="Needs you"]')!;
  expect(needs.textContent).toContain("Study plan");
  const done = document.querySelector('[data-section="Done today"]')!;
  expect(done.textContent).toContain("The model was unreachable");
  expect(done.textContent).toContain("Morning");
  expect(activityArea.nav).toBe("Activity");
});

test("empty sections say None and rows open", () => {
  const onOpen = vi.fn();
  render(<ActivityView jobs={[jobs[1]!]} onOpen={onOpen} />);
  expect(screen.getAllByText("None.")).toHaveLength(2);
  fireEvent.click(screen.getByText("Mock exam"));
  expect(onOpen).toHaveBeenCalledWith("b");
});
