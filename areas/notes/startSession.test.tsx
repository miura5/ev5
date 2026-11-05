import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NotesScreen as RawNotesScreen } from "./Notes.screen.tsx";
import { withToasts } from "../testToasts.tsx";
import type { NotesServices } from "./useNotes.ts";

const NotesScreen = withToasts(RawNotesScreen);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const note = {
  schema: 1,
  writer: "page",
  at: "2026-10-26T15:00:00.000Z",
  source: "E.V. Home",
  createdAt: "2026-10-26T15:00:00.000Z",
  title: "Fluids",
  course: "NUR 112",
  blocks: [{ type: "h1", runs: [{ text: "Fluids" }] }],
};
const services: NotesServices = {
  docs: {
    list: async (c) =>
      c === "notes" ? [{ id: "n1", v: 1, at: 1, data: note }] : [],
  },
  outbox: {
    queueNote: vi.fn(),
    replay: vi.fn(async () => ({ refused: [] })),
  },
};

async function openNote(onNavigate: (p: string) => void) {
  render(<NotesScreen services={services} onNavigate={onNavigate} />);
  fireEvent.click(await screen.findByText("Fluids"));
  return screen.findByRole("button", { name: "Start session" });
}

test("Start session calls session.start, then opens Sessions", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ mode: "direct", result: { id: "ss-1" } })),
  );
  vi.stubGlobal("fetch", fetchMock);
  const onNavigate = vi.fn();
  fireEvent.click(await openNote(onNavigate));
  await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("/sessions"));
  const start = fetchMock.mock.calls.find((c) =>
    String((c as unknown[])[0]).includes("commands/session.start"),
  ) as unknown as [string, RequestInit] | undefined;
  expect(start).toBeDefined();
  expect(JSON.parse(String(start?.[1].body))).toMatchObject({
    input: { noteId: "n1" },
  });
});

test("a refused start stays on the note and says why", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 503 })),
  );
  const onNavigate = vi.fn();
  fireEvent.click(await openNote(onNavigate));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("went wrong"),
  );
  expect(onNavigate).not.toHaveBeenCalled();
});

test("?open=<id> opens that note's page; an unknown id shows the list", async () => {
  window.history.pushState({}, "", "/notes?open=n1");
  render(<NotesScreen services={services} />);
  expect(
    await screen.findByRole("button", { name: "Start session" }),
  ).toBeDefined();
  cleanup();
  window.history.pushState({}, "", "/notes?open=nope");
  render(<NotesScreen services={services} />);
  expect(await screen.findByText("Fluids")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Start session" })).toBeNull();
  window.history.pushState({}, "", "/");
});
