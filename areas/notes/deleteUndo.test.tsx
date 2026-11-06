import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { noteDoc } from "../../domain/index.ts";
import { NotesScreen as RawNotesScreen } from "./Notes.screen.tsx";
import { withToasts } from "../testToasts.tsx";
import type { NotesServices } from "./useNotes.ts";

const NotesScreen = withToasts(RawNotesScreen);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const services: NotesServices = {
  docs: {
    list: async () => [
      {
        id: "n1",
        v: 1,
        at: 1,
        data: noteDoc(null, {
          blocks: [{ type: "h1", runs: [{ text: "Kept" }] }],
          at: "2026-11-01T10:00:00.000Z",
          source: "v5/notes",
        }),
      },
    ],
  },
  outbox: {
    queueNote: async () => undefined,
    replay: async () => ({ refused: [] }),
  },
};

test("after a collection is deleted, Notes shows Undo and Undo restores it", async () => {
  localStorage.setItem("ev5.token", "t");
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      sent.push(`${String(url)} ${String(init?.body ?? "")}`);
      return new Response(
        JSON.stringify({ ok: true, mode: "direct", result: {} }),
        {
          status: 200,
        },
      );
    }),
  );
  render(<NotesScreen services={services} search="deleted=c1&what=collection" />);
  expect(await screen.findByText("Collection deleted")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(sent.join()).toContain("item.restore"));
});

test("a note page has Delete, which shows Undo", async () => {
  localStorage.setItem("ev5.token", "t");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, mode: "direct", result: {} }), {
          status: 200,
        }),
    ),
  );
  render(<NotesScreen services={services} search="open=n1" />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  expect(await screen.findByText("Note deleted")).toBeTruthy();
});
