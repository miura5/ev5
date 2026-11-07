import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryHosted as LibraryScreen, goalRow } from "./testHost.tsx";
import { ExamPlanDetail } from "./testHost.tsx";
import { mapLibrary } from "./map.ts";
import type { GoalRow } from "../../domain/index.ts";

/** The address query the shell hands the screen. */
const SEARCH = "open=x1";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const exam = goalRow;

/** A draft plan row for the exam. */
const draft = { id: "plan-j1", data: { goal_id: "x1", state: "draft" } };

/** Boots the screen on the exam; commands answer with `status`; returns the command calls made. */
function boot(examDoc: GoalRow, plans: unknown[] = [], status = 200) {
  localStorage.setItem("ev5.token", "t");
  const sent: { name: string; input: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string, init?: RequestInit) => {
      const url = String(u);
      const cmd = /commands\/([\w.]+)/.exec(url)?.[1];
      if (cmd) {
        sent.push({
          name: cmd,
          input: (JSON.parse(String(init?.body)) as { input: unknown }).input,
        });
        return new Response(JSON.stringify({ mode: "direct", result: {} }), {
          status,
        });
      }
      if (/\/(weak-spots|weak-spot-events|links)$/.test(url))
        return new Response(JSON.stringify({ rows: [] }));
      if (/\/goals$/.test(url))
        return new Response(JSON.stringify({ rows: [examDoc] }));
      const c = /collection=(\w+)/.exec(url)?.[1] ?? "";
      const list: Record<string, unknown[]> = { plans };
      return new Response(JSON.stringify({ docs: list[c] ?? [] }), {
        status: 200,
      });
    }),
  );
  render(<LibraryScreen search={SEARCH} />);
  return sent;
}

test("Plan with E.V. runs date.plan_with_ev for the exam", async () => {
  const sent = boot(exam({}));
  fireEvent.click(await screen.findByText("Plan with E.V."));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    name: "date.plan_with_ev",
    input: { id: "x1" },
  });
});

test("a draft plan can be approved", async () => {
  const sent = boot(exam({}), [draft]);
  fireEvent.click(await screen.findByText("Approve"));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    name: "plan.approve",
    input: { id: "plan-j1" },
  });
});

test("a draft plan can be put away", async () => {
  const sent = boot(exam({}), [draft]);
  fireEvent.click(await screen.findByText("Put away"));
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    name: "plan.put_away",
    input: { id: "plan-j1" },
  });
});

test("changes go with his note, and need one", async () => {
  const sent = boot(exam({}), [draft]);
  fireEvent.click(
    await screen.findByRole("button", { name: "Ask for changes" }),
  );
  const send = await screen.findByText("Send changes");
  expect((send as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("What should change?"), {
    target: { value: " fewer evenings " },
  });
  fireEvent.click(send);
  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({
    name: "plan.ask_changes",
    input: { id: "plan-j1", note: "fewer evenings" },
  });
});

test("a plan already in force shows no approve controls", async () => {
  boot(exam({}), [
    { id: "plan-j1", data: { goal_id: "x1", state: "in_force" } },
  ]);
  await screen.findByText("Review the prep plan");
  expect(screen.getByText("in force")).toBeTruthy();
  expect(screen.queryByText("Approve")).toBeNull();
});

test("a command the server cannot do yet says so in plain words", async () => {
  boot(exam({}), [], 501);
  fireEvent.click(await screen.findByText("Plan with E.V."));
  expect(
    await screen.findByText("E.V. cannot do that yet. It is not ready."),
  ).toBeTruthy();
});

test("any other failure shows the plain failure sentence", async () => {
  boot(exam({}), [draft], 500);
  fireEvent.click(await screen.findByText("Approve"));
  expect(
    await screen.findByText(
      "Something went wrong on E.V.'s side. Try again in a moment.",
    ),
  ).toBeTruthy();
});

test("the detail alone offers the plan actions through its handlers", () => {
  const onPlanWithEv = vi.fn();
  render(
    <ExamPlanDetail
      exam={{
        id: "x",
        title: "E",
        kind: "exam",
        when: "",
        readiness: "",
        plan: "",
        proposals: [],
      }}
      onPlanWithEv={onPlanWithEv}
    />,
  );
  fireEvent.click(screen.getByText("Plan with E.V."));
  expect(onPlanWithEv).toHaveBeenCalled();
});

test("plan state maps: none, draft, approved, away", () => {
  const state = (plans: unknown[], extra: Record<string, unknown>) =>
    mapLibrary(
      {
        goals: [exam(extra)],
        weakspots: [],
        sets: [],
        plans: plans as never,
      },
      Date.parse("2026-11-04T12:00:00Z"),
    ).exams[0]?.planState;
  expect(state([], {})).toBe("none");
  expect(
    state([{ id: "p", data: { goal_id: "x1", state: "draft" } }], {}),
  ).toBe("draft");
  expect(
    state([{ id: "p", data: { goal_id: "x1", state: "in_force" } }], {}),
  ).toBe("approved");
  expect(
    state([{ id: "p", data: { goal_id: "x1", state: "put_away" } }], {}),
  ).toBe("away");
});
