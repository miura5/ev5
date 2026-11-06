import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { activityArea } from "./area.ts";
import { ActivityView, type ActivityJob } from "./Activity.view.tsx";
import { toActivityJob, uniqueRows } from "./useJobs.ts";

test("two needs-you jobs that read the same list once (the sidebar and Ask count once too)", () => {
  const w = { kind: "prep_plan", state: "needs-you" as const, summary: "Plan needs you. Rate it.", lead: "Plan needs you." };
  const rows = uniqueRows([{ id: "a", ...w }, { id: "b", ...w }].map(toActivityJob));
  expect(rows.map((r) => r.id)).toEqual(["a"]);
});

afterEach(cleanup);

const jobs: ActivityJob[] = [
  {
    id: "a",
    title: "Prep plan",
    state: "needs-you",
    reason: "Rate your confidence",
    summary: "x",
  },
  {
    id: "b",
    title: "Full practice run",
    state: "running",
    summary: "Writing full practice run",
  },
  {
    id: "c",
    title: "Practice set",
    state: "failed",
    reason: "The model was unreachable",
    summary: "y",
  },
  { id: "d", title: "Morning", state: "done", summary: "Morning is done." },
];

test("jobs sit in their sections and failed shows its reason", () => {
  render(<ActivityView jobs={jobs} />);
  const needs = screen.getByRole("region", { name: "Needs you" });
  expect(needs.textContent).toContain("Prep plan");
  const done = screen.getByRole("region", { name: "Done today" });
  expect(done.textContent).toContain("The model was unreachable");
  expect(done.textContent).toContain("Morning");
  expect(activityArea.nav).toBe("Activity");
});

test("wire jobs become rows with the reason for needs-you and failed", () => {
  const j = toActivityJob({
    id: "z",
    kind: "prep-plan",
    state: "needs-you",
    summary: "Rate it.",
  });
  expect(j).toMatchObject({ title: "Prep plan", reason: "Rate it." });
  expect(
    toActivityJob({ id: "y", kind: "x", state: "running", summary: "s" })
      .reason,
  ).toBeUndefined();
});

test("empty sections say None and rows open", () => {
  const onOpen = vi.fn();
  render(<ActivityView jobs={[jobs[1]!]} onOpen={onOpen} />);
  expect(screen.getAllByText("None.")).toHaveLength(2);
  fireEvent.click(screen.getByText("Full practice run"));
  expect(onOpen).toHaveBeenCalledWith("b");
});

test("the spend alert can be acknowledged from its row, and only it", () => {
  const onDismiss = vi.fn();
  const alert = toActivityJob({
    id: "spend-alert:2026-11",
    kind: "spend-alert",
    state: "needs-you",
    summary: "80% used",
  });
  expect(alert.dismissable).toBe(true);
  expect(
    toActivityJob({
      id: "z",
      kind: "prep-plan",
      state: "needs-you",
      summary: "s",
    }).dismissable,
  ).toBeUndefined();
  render(<ActivityView jobs={[alert]} onDismiss={onDismiss} />);
  fireEvent.click(screen.getByRole("button", { name: "Got it" }));
  expect(onDismiss).toHaveBeenCalledWith("spend-alert:2026-11");
});

test("a server that sends lead and reason apart is used as is, with no sentence trimming", () => {
  const j = toActivityJob({
    id: "q",
    kind: "prep_plan",
    state: "needs-you",
    summary: "Prep plan needs you. Rate it. It is waiting in Activity.",
    lead: "Prep plan needs you.",
    reason: "Rate it. Then approve.",
  });
  expect(j).toMatchObject({ summary: "Prep plan needs you.", reason: "Rate it. Then approve." });
  const f = toActivityJob({
    id: "r",
    kind: "prep-plan",
    state: "failed",
    summary: "x",
    lead: "The plan did not finish.",
    reason: "No exam date.",
  });
  expect(f.reason).toBe("No exam date.");
});
