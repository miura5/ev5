import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryHosted as LibraryScreen } from "./testHost.tsx";
import { mapLibrary } from "./map.ts";

/** The address query the shell hands the screen. */
const SEARCH = "open=x1";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const exam = {
  id: "x1",
  data: {
    schema: 2,
    writer: "page",
    at: "2026-10-01T15:00:00Z",
    source: "test",
    title: "Exam Three",
    kind: "exam",
    date: "2099-01-05",
    course: "NUR 112",
  },
};
const waitingJob = {
  id: "j1",
  kind: "prep_plan",
  state: "needs-you",
  goalId: "x1",
};

/** Boots the screen on the exam with a waiting plan job; returns the calls made to commands and job answers. */
function boot(jobs: unknown[] = [waitingJob]) {
  localStorage.setItem("ev5.token", "t");
  const sent: { to: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string, init?: RequestInit) => {
      const url = String(u);
      if (init?.method === "POST") {
        sent.push({
          to: url.replace(/^.*\/api\/v1\//, ""),
          body: JSON.parse(String(init.body)),
        });
        return new Response("{}", { status: 202 });
      }
      if (/\/jobs$/.test(url))
        return new Response(JSON.stringify({ jobs }), { status: 200 });
      const c = /collection=(\w+)/.exec(url)?.[1] ?? "";
      return new Response(
        JSON.stringify({ docs: c === "exams" ? [exam] : [] }),
        { status: 200 },
      );
    }),
  );
  render(<LibraryScreen search={SEARCH} />);
  return sent;
}

test("a waiting plan job maps to a draft carrying the job id", () => {
  const e = mapLibrary(
    { exams: [exam] as never, weakspots: [], sets: [], jobs: [waitingJob] },
    Date.parse("2026-11-04T12:00:00Z"),
  ).exams[0];
  expect(e?.planState).toBe("draft");
  expect(e?.planId).toBe("j1");
  expect(e?.waiting).toBe(true);
});

test("jobs that are not this exam's waiting plan change nothing", () => {
  const state = (jobs: unknown[]) =>
    mapLibrary(
      { exams: [exam] as never, weakspots: [], sets: [], jobs: jobs as never },
      Date.parse("2026-11-04T12:00:00Z"),
    ).exams[0]?.planState;
  expect(state([{ ...waitingJob, goalId: "other" }])).toBe("none");
  // A running plan job is being saved: it shows neither a draft nor an earlier plan.
  expect(state([{ ...waitingJob, state: "running" }])).toBe("working");
  expect(state([{ ...waitingJob, kind: "practice_set" }])).toBe("none");
});

test("Approve on a waiting plan answers the job", async () => {
  const sent = boot();
  fireEvent.click(await screen.findByText("Approve"));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    to: "jobs/j1/continue",
    body: { answer: { decision: "approve" } },
  });
});

test("Put away on a waiting plan answers the job", async () => {
  const sent = boot();
  fireEvent.click(await screen.findByText("Put away"));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    to: "jobs/j1/continue",
    body: { answer: { decision: "put_away" } },
  });
});

test("Asking for changes sends the job id to plan.ask_changes", async () => {
  const sent = boot();
  fireEvent.click(
    await screen.findByRole("button", { name: "Ask for changes" }),
  );
  fireEvent.change(screen.getByLabelText("What should change?"), {
    target: { value: "fewer evenings" },
  });
  fireEvent.click(screen.getByText("Send changes"));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    to: "commands/plan.ask_changes",
    body: { input: { id: "j1", note: "fewer evenings" } },
  });
});

test("with no waiting plan the exam offers Plan with E.V.", async () => {
  boot([]);
  expect(await screen.findByText("Plan with E.V.")).toBeTruthy();
  expect(screen.queryByText("Approve")).toBeNull();
});

const sessions = [
  { date: "2099-01-04", title: "Misses only", minutes: 10 },
  { date: "2099-01-02", title: "Dosage by weight", minutes: 25 },
];

test("opened by a link, the plan shows its sessions by day with minutes and Built from", async () => {
  boot([{ ...waitingJob, tasks: sessions }]);
  await screen.findByText("Proposed sessions");
  const rows = [...document.querySelectorAll('[data-part="proposal"] [data-ui="row"]')].map(
    (r) => r.textContent,
  );
  expect(rows).toEqual(["Dosage by weightFri Jan 225m", "Misses onlySun Jan 410m"]);
  expect(screen.getByText(/Built from/)).toBeTruthy();
});

test("Review the prep plan toggles the proposal", async () => {
  boot();
  await screen.findByText("Proposed sessions");
  fireEvent.click(screen.getByText("Review the prep plan"));
  expect(screen.queryByText("Proposed sessions")).toBeNull();
  fireEvent.click(screen.getByText("Review the prep plan"));
  expect(screen.getByText("Proposed sessions")).toBeTruthy();
});

test("Approve and Send changes each give a sign", async () => {
  boot();
  fireEvent.click(await screen.findByText("Approve"));
  await screen.findByText("Plan approved");
  fireEvent.click(screen.getByRole("button", { name: "Ask for changes" }));
  fireEvent.change(screen.getByLabelText("What should change?"), {
    target: { value: "fewer evenings" },
  });
  fireEvent.click(screen.getByText("Send changes"));
  await screen.findByText("Changes sent");
});
