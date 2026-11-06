import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LibraryHosted as LibraryScreen } from "./testHost.tsx";
import { LibraryScreen as RawScreen } from "./Library.screen.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
        kind: "exam",
        date: "2099-01-05",
        course: "Biology 101",
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

function stub() {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: string) => {
      const c = /collection=(\w+)/.exec(String(u))?.[1] ?? "";
      return new Response(JSON.stringify({ docs: docs[c] ?? [] }), {
        status: 200,
      });
    }),
  );
}

function boot(open: string) {
  stub();
  render(<LibraryScreen search={`open=${open}`} />);
}

test("?open=<exam id> opens its plan detail", async () => {
  boot("x1");
  await waitFor(() =>
    expect(screen.getByText("Review the prep plan")).toBeTruthy(),
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
    expect(screen.getByRole("radio", { name: "Dates1" })).toBeTruthy(),
  );
  expect(screen.queryByText("Review the prep plan")).toBeNull();
  expect(screen.queryByText("How many mL?")).toBeNull();
});

test("a date's detail sits beside the library with the date and days left, and no course line", async () => {
  boot("x1");
  await waitFor(() =>
    expect(screen.getByText("Review the prep plan")).toBeTruthy(),
  );
  const panel = document.querySelector('[data-ui="detail"]') as HTMLElement;
  const lib = document.querySelector('[data-ui="page"]') as HTMLElement;
  expect(panel).toBeTruthy();
  // After the page in the document, never above it.
  expect(
    lib.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const row = (label: string) =>
    screen.getAllByText(label).find((e) => panel.contains(e))?.parentElement
      ?.textContent ?? "";
  // No linked collection title is read, so neither a Course nor a Collection line shows.
  expect(screen.queryByText("Course")).toBeNull();
  expect(screen.queryByText("Collection")).toBeNull();
  expect(row("Date")).toMatch(/in [\d]+ days|years|weeks|days/);
  expect(row("Date")).not.toContain("Biology 101");
});

test("the open set follows the address: Back and Forward change it, opening asks the shell to navigate", async () => {
  stub();
  const go: string[] = [];
  const { rerender } = render(
    <RawScreen search="" onNavigate={(t) => go.push(t)} />,
  );
  fireEvent.click(await screen.findByRole("radio", { name: /Sets/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Doses/ }));
  expect(go).toEqual(["/library?open=s1"]);
  // The shell moves the address; the screen shows the set.
  rerender(<RawScreen search="open=s1" onNavigate={(t) => go.push(t)} />);
  await waitFor(() => expect(screen.getByText("How many mL?")).toBeTruthy());
  // Back: the address loses ?open=, the list returns.
  rerender(<RawScreen search="" onNavigate={(t) => go.push(t)} />);
  await waitFor(() => expect(screen.queryByText("How many mL?")).toBeNull());
  expect(screen.getByRole("radio", { name: /Sets/ })).toBeTruthy();
  // Forward: the set again.
  rerender(<RawScreen search="open=s1" onNavigate={(t) => go.push(t)} />);
  await waitFor(() => expect(screen.getByText("How many mL?")).toBeTruthy());
});
