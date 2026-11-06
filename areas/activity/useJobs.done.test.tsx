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
                kind: "prep_plan",
                state: "done",
                summary: "Prep plan is done.",
                lead: "Prep plan is done.",
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
      ["Prep plan", "done", "Prep plan is done."],
      ["Session", "done", "Studied 25 minutes."],
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
                kind: "prep_plan",
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

test("Done today lists every finished job, even ones that read alike, and names a plan's exam", async () => {
  localStorage.setItem("ev5.token", "t");
  const plan = (id: string, goalTitle?: string) => ({
    id,
    kind: "prep_plan",
    state: "done",
    summary: "Your prep plan is ready.",
    lead: "Your prep plan is ready.",
    goalTitle,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).includes("finished=today")
        ? json({
            jobs: [
              plan("a", "e2e plan exam"),
              plan("b", "e2e plan exam"),
              plan("c"),
            ],
          })
        : json({ jobs: [] }),
    ),
  );
  const { result } = renderHook(() => useJobs());
  await waitFor(() => expect(result.current.jobs).toHaveLength(3));
  expect(result.current.jobs.map((j) => j.title)).toEqual([
    "Prep plan · e2e plan exam",
    "Prep plan · e2e plan exam",
    "Prep plan",
  ]);
});
