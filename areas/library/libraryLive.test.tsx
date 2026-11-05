import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryHosted as LibraryScreen } from "./testHost.tsx";
import { mapLibrary } from "./map.ts";
import { PLAN_POLL_MS } from "./useLibrary.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

const base = {
  schema: 2,
  writer: "page",
  at: "2026-10-01T15:00:00Z",
  source: "t",
};
const exam = (extra: Record<string, unknown> = {}) => ({
  id: "x1",
  data: {
    ...base,
    title: "Exam Three",
    kind: "unit",
    date: "2099-01-05",
    course: "NUR 112",
    ...extra,
  },
});
const tasks = [
  { date: "2099-01-02", title: "Review heart sounds", minutes: 30 },
  { date: "2099-01-03", title: "Practice set", minutes: 20 },
];

test("a draft that arrives while the Detail is open shows Approve without a reload", async () => {
  const fns: (() => void)[] = [];
  const real = globalThis.setInterval;
  vi.spyOn(globalThis, "setInterval").mockImplementation(((
    f: () => void,
    ms?: number,
  ) => {
    if (ms === PLAN_POLL_MS) {
      fns.push(f);
      return 0 as never;
    }
    return real(f, ms);
  }) as never);
  localStorage.setItem("ev5.token", "t");
  window.history.replaceState(null, "", "/library?open=x1");
  let jobs: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      const url = String(u);
      if (url.includes("/jobs")) return new Response(JSON.stringify({ jobs }));
      const c = /collection=(\w+)/.exec(url)?.[1] ?? "";
      return new Response(
        JSON.stringify({ docs: c === "exams" ? [exam()] : [] }),
      );
    }),
  );
  render(<LibraryScreen />);
  await screen.findByText("Plan with E.V.");
  expect(screen.queryByText("Approve")).toBeNull();
  jobs = [
    { id: "j1", kind: "study-plan", state: "needs-you", examId: "x1", tasks },
  ];
  await act(async () => {
    fns.forEach((f) => f());
  });
  await waitFor(() => expect(screen.getByText("Approve")).toBeTruthy());
  expect(screen.getByText("Ask for changes")).toBeTruthy();
  expect(screen.getByText("Put away")).toBeTruthy();
});

test("an approved plan keeps its sessions listed with the approved line", () => {
  const data = mapLibrary(
    {
      exams: [exam({ planId: "plan-j1" })],
      weakspots: [],
      sets: [],
      planedits: [{ id: "x1", data: { plan: "plan-j1" } }],
      plans: [
        {
          id: "plan-j1",
          data: {
            days: [
              {
                date: "2099-01-03",
                tasks: [{ id: "a", text: "Practice set", minutes: 20 }],
              },
              {
                date: "2099-01-02",
                tasks: [{ id: "b", text: "Review heart sounds", minutes: 30 }],
              },
            ],
          },
        },
      ],
    } as never,
    Date.UTC(2098, 11, 1),
  );
  expect(data.exams[0]?.planState).toBe("approved");
  expect(data.exams[0]?.sessions?.map((s) => s.title)).toEqual([
    "Review heart sounds",
    "Practice set",
  ]);
});
