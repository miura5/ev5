import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryScreen } from "./Library.screen.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const base = {
  schema: 2,
  writer: "page",
  at: "2026-10-01T15:00:00Z",
  source: "test",
};
const docs: Record<string, unknown[]> = {
  exams: [
    {
      id: "x1",
      data: {
        ...base,
        title: "Exam Three",
        kind: "unit",
        date: "2099-01-05",
        course: "NUR 112",
      },
    },
  ],
  weakspots: [
    {
      id: "w1",
      data: {
        ...base,
        topic: "Oral doses",
        objective: "E4-3",
        exam: "x1",
        kind: "concept",
        initial: { streak: 0, nextDue: "2026-11-03", recurrence: 1, misses: 2 },
        events: {},
      },
    },
  ],
  sets: [
    {
      id: "s1",
      data: {
        ...base,
        schema: 3,
        kind: "drill",
        title: "Doses",
        items: [
          {
            id: "q1",
            stem: "How many mL?",
            options: ["2 mL", "5 mL"],
            correct: [1],
          },
        ],
      },
    },
  ],
};

function boot(open: string) {
  localStorage.setItem("ev5.token", "t");
  window.history.replaceState(null, "", `/library?open=${open}`);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      const c = /collection=(\w+)/.exec(String(u))?.[1] ?? "";
      return new Response(JSON.stringify({ docs: docs[c] ?? [] }), {
        status: 200,
      });
    }),
  );
  render(<LibraryScreen />);
}

test("?open=<exam id> opens its plan detail", async () => {
  boot("x1");
  await waitFor(() =>
    expect(screen.getByText("Review the study plan")).toBeTruthy(),
  );
});

test("?open=<set id> opens its set page", async () => {
  boot("s1");
  await waitFor(() => expect(screen.getByText("How many mL?")).toBeTruthy());
});

test("?open=<weak spot id> opens its detail", async () => {
  boot("w1");
  await waitFor(() => expect(screen.getByText("Oral doses")).toBeTruthy());
});

test("an unknown id does nothing", async () => {
  boot("nope");
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "Exams1" })).toBeTruthy(),
  );
  expect(screen.queryByText("Review the study plan")).toBeNull();
  expect(screen.queryByText("How many mL?")).toBeNull();
});
