import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NotesScreen } from "./Notes.screen.tsx";
import type { NotesServices } from "./useNotes.ts";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const services: NotesServices = {
  rows: { list: async () => [] },
  outbox: { queueNote: vi.fn(), replay: vi.fn(async () => ({ refused: [] })) },
};

test("New collection makes an untitled collection and opens it ready to type", async () => {
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") sent.push(`${url} ${String(init.body)}`);
      return Promise.resolve(
        new Response(
          JSON.stringify(
            init?.method === "POST"
              ? { mode: "direct", result: { collection: { id: "c9" } } }
              : {},
          ),
          { status: 200 },
        ),
      );
    }),
  );
  localStorage.setItem("ev5.token", "t");
  const onNavigate = vi.fn();
  render(<NotesScreen services={services} onNavigate={onNavigate} />);
  fireEvent.click(screen.getByText("New collection"));
  await waitFor(() =>
    expect(onNavigate).toHaveBeenCalledWith("/collection/c9?new=1"),
  );
  expect(sent[0]).toContain("commands/collection.create");
  expect(sent[0]).toContain("Untitled collection");
});
