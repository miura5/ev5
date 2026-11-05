import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useJobs } from "./useJobs.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

test("Done today shows jobs and sessions finished today, with plain names", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).includes("finished=today")
        ? json({
            jobs: [
              {
                id: "j1",
                kind: "study_plan",
                state: "done",
                summary: "Study plan is done.",
                lead: "Study plan is done.",
              },
              {
                id: "ss-1",
                kind: "study-session",
                state: "done",
                summary: "Studied 25 minutes.",
                lead: "Studied 25 minutes.",
              },
            ],
          })
        : json({ jobs: [] }),
    ),
  );
  const { result } = renderHook(() => useJobs());
  await waitFor(() => expect(result.current.jobs).toHaveLength(2));
  expect(result.current.jobs.map((j) => [j.title, j.state, j.summary])).toEqual(
    [
      ["Study plan", "done", "Study plan is done."],
      ["Study session", "done", "Studied 25 minutes."],
    ],
  );
});

test("if the finished read fails, the unfinished jobs still show", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).includes("finished=today")
        ? new Response("{}", { status: 500 })
        : json({
            jobs: [
              {
                id: "j2",
                kind: "study_plan",
                state: "running",
                summary: "Working",
                lead: "Working",
              },
            ],
          }),
    ),
  );
  const { result } = renderHook(() => useJobs());
  await waitFor(() => expect(result.current.jobs).toHaveLength(1));
  expect(result.current.error).toBeUndefined();
});
