import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SessionsScreen } from "./Sessions.screen.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const KEY = "note-images/abcdefghijklmnop.png";
const base = { schema: 2, writer: "page", at: "2026-11-04T15:00:00.000Z" };
const session = {
  id: "s1",
  v: 3,
  data: {
    ...base,
    source: "E.V. Home",
    date: "2026-11-04",
    topic: "Session",
    noteId: "n1",
    status: "active",
    startedAt: new Date(Date.now() - 60_000).toISOString(),
  },
};
const note = {
  v: 5,
  data: {
    ...base,
    schema: 1,
    source: "E.V. Home",
    createdAt: "2026-11-04T15:00:00.000Z",
    title: "Heart",
    blocks: [
      { type: "p", runs: [{ text: "Intro" }] },
      { type: "img", key: KEY, alt: "Curve", runs: [] },
    ],
  },
};

function stub(first?: { type: string; runs: { text: string }[] }) {
  const puts: unknown[] = [];
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x" }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("commands/")) {
        puts.push(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ mode: "direct" }),
        };
      }
      if (url.includes("note-images"))
        return { ok: true, status: 200, blob: async () => new Blob(["x"]) };
      const json = url.includes("collection=notes")
        ? first
          ? {
              ...note,
              data: { ...note.data, blocks: [first, ...note.data.blocks] },
            }
          : note
        : { docs: [session] };
      return { ok: true, status: 200, json: async () => json };
    }),
  );
  localStorage.setItem("ev5.token", "t");
  return puts;
}

test("a session over a note shows the note's title once, with no session heading or date", async () => {
  stub();
  render(<SessionsScreen />);
  await screen.findByRole("heading", { name: "Heart" });
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.queryByRole("heading", { name: "Session" })).toBeNull();
  expect(document.querySelector(".kit-doc-meta")).toBeNull();
});

test("the note's pictures show as pictures, not the word Image", async () => {
  stub();
  render(<SessionsScreen />);
  const img = await screen.findByRole("img", { name: "Curve" });
  expect((img as HTMLImageElement).src).toBe("blob:x");
  expect(screen.queryByText(/^Image/)).toBeNull();
});

test("focus is on the session page, so Space pauses with no click first", async () => {
  const puts = stub();
  render(<SessionsScreen />);
  await screen.findByRole("heading", { name: "Heart" });
  const page = document.querySelector(".ev-session");
  expect(document.activeElement).toBe(page);
  fireEvent.keyDown(document.activeElement as Element, { key: " " });
  await vi.waitFor(() => expect(puts).toHaveLength(1));
});

test("a note whose first heading repeats its title shows the title once", async () => {
  stub({ type: "h1", runs: [{ text: "Heart" }] });
  render(<SessionsScreen />);
  await screen.findByRole("heading", { name: "Heart" });
  expect(screen.getAllByRole("heading", { name: "Heart" })).toHaveLength(1);
  expect(screen.getByText("Intro")).toBeTruthy();
});
